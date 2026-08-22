from __future__ import annotations

import functools
from typing import Any, Iterable, Optional, Tuple
from uuid import UUID, uuid4

from pydantic import BaseModel

from app import models, scheme
from app.logger import logger
from .locks import session_write_lock
from .scene_manager import SessionSceneManager
from app.plugins.registry_singleton import registry
from app.services.action_events import (
    broadcast_to_log,
    extract_workflow_log_lines,
    log_event_draft_to_model,
)
from plugins.common.types import *

from app.scheme import ActionRecord, Scene, Player
from app.services.action_cancel_policy import user_may_cancel_action


def _serialized(method):
    """Один пишущий в список действий за раз (BE-16).

    Список действий читается целиком, меняется в памяти и записывается целиком,
    поэтому параллельные вызовы затирают друг друга. Оборачиваем только
    публичные методы: `submit_action_step` и соседи вызывают их изнутри, но сами
    блокировку не берут — иначе получился бы самозахват.
    """

    @functools.wraps(method)
    async def wrapper(self, *args, **kwargs):
        async with session_write_lock(self._session_key()):
            return await method(self, *args, **kwargs)

    return wrapper


def _dump_json(x: Any) -> Any:
    # для Redis и для plugin payload, если надо
    if isinstance(x, BaseModel):
        return x.model_dump(mode="json")
    if isinstance(x, list):
        return [_dump_json(i) for i in x]
    if isinstance(x, dict):
        return {k: _dump_json(v) for k, v in x.items()}
    return x

def _user_uuid(x) -> Optional[UUID]:
    return x.id if x is not None else None




def _deep_merge(a: Any, b: Any) -> Any:
    # dict + dict -> рекурсивный merge, иначе b заменяет a
    if isinstance(a, dict) and isinstance(b, dict):
        out = dict(a)
        for k, v in b.items():
            if k in out:
                out[k] = _deep_merge(out[k], v)
            else:
                out[k] = v
        return out
    return b

def _index_by_str_id(xs: Iterable[Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for x in xs or []:
        _id = getattr(x, "id", None)
        if _id is None:
            continue
        out[str(_id)] = x
    return out

def _apply_data_patch_to_model(obj: Any, data_patch: dict[str, Any]) -> Any:
    """
    Обновляет поле .data у pydantic-модели:
    - берём текущий obj.data (dict)
    - deep-merge с data_patch
    - возвращаем obj.model_copy(update={"data": new_data})
    - затем пере-валидируем через model_validate, чтобы nested-модели не превратились в dict [web:471]
    """
    cur_data = getattr(obj, "data", None) or {}
    cur_data = cur_data if isinstance(cur_data, dict) else {}

    new_data = _deep_merge(cur_data, data_patch)

    if hasattr(obj, "model_copy"):
        obj2 = obj.model_copy(update={"data": new_data})
    else:
        setattr(obj, "data", new_data)
        obj2 = obj

    # revalidate (важно в v2)
    cls = obj2.__class__
    if hasattr(cls, "model_validate"):
        obj2 = cls.model_validate(obj2.model_dump())  # прогоняем через схему заново [web:471]
    return obj2

def _patch_list_by_id(
    items: list[Any],
    patch_items: list[dict[str, Any]],
) -> Tuple[list[Any], bool]:
    """
    patch_items: [{"id": "...", "dataPatch": {...}}]
    """
    if not items or not patch_items:
        return list(items or []), False

    by_id = _index_by_str_id(items)
    updated = list(items)
    changed = False

    for p in patch_items:
        if not isinstance(p, dict):
            continue
        pid = p.get("id")
        if pid is None:
            continue
        obj = by_id.get(str(pid))
        if not obj:
            continue

        data_patch = p.get("dataPatch", {})
        if not isinstance(data_patch, dict):
            continue

        obj_new = _apply_data_patch_to_model(obj, data_patch)


        tags_patch = p.get("tagsPatch", None)
        if tags_patch:
            obj_new.tags = tags_patch
        # replace in list
        for i, it in enumerate(updated):
            if str(getattr(it, "id", "")) == str(pid):
                updated[i] = obj_new
                changed = True
                break

    return updated, changed



class SessionActionManager(SessionSceneManager):
    async def _get_state(self) -> scheme.GameSessionInner:
        return await self.get_inner()

    def _get_factory(self, inner: scheme.GameSessionInner):
        rule_id = getattr(inner, "rule_id_str", None)
        if not rule_id:
            raise RuntimeError("rule_id_str is not set on session inner")
        plugin = registry.get(rule_id)
        if not plugin:
            raise RuntimeError(f"rules plugin not found: {rule_id}")
        return plugin.get_factory()

    # ---------- actions storage (Redis boundary) ----------

    def _list_actions(self, inner: scheme.GameSessionInner) -> list[ActionRecord]:
        raw = getattr(inner, "actions", None) or []
        out: list[ActionRecord] = []
        for x in raw:
            out.append(x if isinstance(x, ActionRecord) else ActionRecord.model_validate(x))
        return out

    async def _save_actions(self, actions: list[ActionRecord]) -> None:
        # единственное место, где превращаем модели в JSON-friendly dict/list
        await self.set_field("actions", [a.model_dump(mode="json") for a in actions])

    def _find_action_index(self, actions: list[ActionRecord], action_id: UUID) -> int:
        for i, a in enumerate(actions):
            if a.id == action_id:
                return i
        return -1

    async def _emit_action_side_effects(
        self,
        user: models.User,
        action: ActionRecord,
        *,
        prev_status: str,
        broadcasts: list[dict[str, Any]],
        log_events: list[dict[str, Any]],
    ) -> list[str]:
        wrote = False

        for bc in broadcasts or []:
            log = broadcast_to_log(
                user.id,
                bc,
                action_id=action.id,
                action_key=action.actionKey,
            )
            if log is None:
                continue
            await self._persist_and_add_roll_log(user, action, log)
            wrote = True

        for draft in log_events or []:
            log = log_event_draft_to_model(user.id, draft)
            if log is None:
                continue
            if getattr(log, "log_type", None) == "roll":
                await self._persist_and_add_roll_log(user, action, log)
            else:
                await self.add_log(log)
            wrote = True

        new_status = action.status or ""
        if new_status == "completed" and prev_status != "completed":
            for line in extract_workflow_log_lines(action.workflow if isinstance(action.workflow, dict) else {}):
                await self.add_log(
                    scheme.LogActionText(
                        user_id=user.id,
                        text=line,
                        action_id=action.id,
                        action_key=action.actionKey,
                        tags=["workflow"],
                    )
                )
                wrote = True

        return ["logs"] if wrote else []

    async def _persist_and_add_roll_log(self, user: models.User, action: ActionRecord, log) -> None:
        from app.services.roll_persist import persist_roll_record, sanitize_log_seed

        meta = dict(getattr(log, "meta", None) or {})
        await persist_roll_record(
            session_id=self.session_id,
            user_id=user.id,
            title=str(getattr(log, "title", "") or ""),
            dice=list(getattr(log, "dice", None) or []),
            total=getattr(log, "total", None),
            outcome=getattr(log, "outcome", None),
            seed=getattr(log, "seed", None),
            roll_kind=str(getattr(log, "roll_kind", None) or "dice.roll"),
            action_id=getattr(log, "action_id", None) or action.id,
            action_key=getattr(log, "action_key", None) or action.actionKey,
            expression=meta.get("expression") or meta.get("stat_id"),
            system_id=meta.get("system_id"),
            character_id=meta.get("character_id"),
            meta=meta,
        )
        # Keep Redis feed lean — no full PNG data-URLs.
        try:
            log.seed = sanitize_log_seed(getattr(log, "seed", None))
        except Exception:
            pass
        await self.add_log(log)

    # ---------- session patch (пока оставим dict) ----------

    def _apply_session_patch_to_inner(
        self,
        inner: scheme.GameSessionInner,
        patch: dict[str, Any],
    ) -> Tuple[scheme.GameSessionInner, list[str]]:
        if not isinstance(patch, dict) or not patch:
            return inner, []
        
        # logger.info(f"PATH {patch=}")

        changed: set[str] = set()

        updated, did = _patch_list_by_id(inner.characters, patch.get("characters"))
        if did:
            inner.characters = updated
            changed.add("characters")

        updated, did = _patch_list_by_id(inner.npcs, patch.get("npcs"))
        if did:
            inner.npcs = updated
            changed.add("npcs")
            changed.add("scenes")
        
        updated, did = _patch_list_by_id(inner.scenes, patch.get("scenes"))
        if did:
            inner.scenes = updated
            changed.add("scenes")

        for scene in inner.scenes:
            updated, did = _patch_list_by_id(scene.public.obstacles, patch.get("obstacles"))
            if did:
                scene.public.obstacles = updated
                changed.add("scenes")
            updated, did = _patch_list_by_id(scene.private.obstacles, patch.get("obstacles"))
            if did:
                scene.private.obstacles = updated
                changed.add("scenes")

        # TODO items
        updated, did = _patch_list_by_id(inner.items, patch.get("items"))
        if did:
            inner.items = updated
            changed.add("items")
            changed.add("scenes")

        return inner, sorted(changed)


    async def _persist_inner_fields(self, inner: scheme.GameSessionInner, fields: list[str]) -> list[str]:
        changed: list[str] = []
        for f in fields:
            if not hasattr(inner, f):
                continue
            await self.set_field(f, _dump_json(getattr(inner, f)))
            changed.append(f)
        return changed


    # ---------- scene payload ----------

    def _build_scene_payload_for_plugin(
        self,
        inner: scheme.GameSessionInner,
        scene_id: UUID,
    ) -> ScenePayload:
        scenes = list(inner.scenes or [])
        scene = next((s for s in scenes if s.id == scene_id), None)
        if scene is None:
            raise RuntimeError(f"scene not found: {scene_id}")
        return self._scene_payload_for_plugin(inner, scene)


    async def _build_action_context(
        self,
        *,
        action_key: str,
        scene_id: UUID,
        actor_user_id: UUID,
        participants: ActionParticipants,
        workflow: Optional[dict[str, Any]] = None,
        input_data: Optional[dict[str, Any]] = None,
        inner: scheme.GameSessionInner,
    ) -> ActionContext:
        scene_payload = self._build_scene_payload_for_plugin(inner, scene_id)
        
        return ActionContext(
            **scene_payload.model_dump(),
            actionKey=action_key,
            scene_id=scene_id,
            actorUserId=actor_user_id,
            participants=participants,
            workflow=workflow,
            input=input_data,
        )

    # ---------- public api ----------

    @_serialized
    async def create_action(
        self,
        user: models.User,
        *,
        action_key: str,
        scene_id: UUID,
        params: Optional[dict[str, Any]] = None,          # можешь потом убрать, если не нужно
        initiator_user_id: Optional[UUID] = None,
    ) -> Tuple[bool, list[str], Optional[dict[str, Any]]]:
        inner = await self._get_state()
        factory = self._get_factory(inner)

        initiator_uid = initiator_user_id or user.id
        gm_uid = _user_uuid(inner.master)   # Optional[UUID]

        # ВАЖНО: если gmUserId у тебя в Participants НЕ Optional — тут надо решить политику.
        if gm_uid is None:
            return False, [], None  # или raise, или делай gmUserId: Optional[UUID] в модели

        participants = ActionParticipants(
            gmUserId=gm_uid,
            initiatorUserId=initiator_uid,
            participants=[],
            placeholders={},
        )

        payload = await self._build_action_context(
            action_key=action_key,
            scene_id=scene_id,
            actor_user_id=user.id,
            participants=participants,
            workflow=None,
            input_data=None,
            inner=inner,
        )

        wf_res = factory.handle(
            kind="workflow.start",
            entity="action",
            payload=payload.model_dump(mode="json"),
            context={},
        )

        if not wf_res.get("ok"):
            logger.error(
                "workflow.start failed: action_key=%s scene_id=%s issues=%s",
                action_key,
                scene_id,
                wf_res.get("issues"),
            )
            return False, [], None

        submit_result = SubmitResult.model_validate(_dump_json(wf_res))

        if not submit_result.ok:
            return False, [], None

        wf = submit_result.workflow.model_dump()
        tags = submit_result.workflow.tags or []
        participant_ids_raw = wf_res.get("participantIds") or []

        # participantIds приводим к UUID, но храним модельно
        participant_ids: list[UUID] = []
        for x in participant_ids_raw:
            participant_ids.append(x if isinstance(x, UUID) else UUID(str(x)))

        action = ActionRecord(
            id=uuid4(),
            actionKey=action_key,
            tags=tags,
            status=(wf.get("status") if isinstance(wf, dict) else None) or "active",
            scene_id=scene_id,
            participants=participants,
            participantIds=participant_ids,
            workflow=wf if isinstance(wf, dict) else {},
            issues=[],
            lastError=None,
            sessionPatch=None,
            can_close=submit_result.can_close,
        )

        actions = self._list_actions(inner)
        actions.append(action)
        await self._save_actions(actions)

        return True, ["actions"], action.model_dump(mode="json")


    @_serialized
    async def submit_action(
        self,
        user: models.User,
        *,
        action_id: UUID,
        input_data: dict[str, Any],
    ) -> Tuple[bool, list[str], Optional[dict[str, Any]], Optional[list[dict[str, Any]]]]:
        inner = await self._get_state()
        factory = self._get_factory(inner)

        actions = self._list_actions(inner)
        idx = self._find_action_index(actions, action_id)
        if idx < 0:
            return False, [], None, None

        action = actions[idx]
        prev_status = action.status or ""
        payload = await self._build_action_context(
            action_key=action.actionKey,
            scene_id=action.scene_id,
            actor_user_id=user.id,
            participants=action.participants,
            workflow=action.workflow or {},
            input_data=input_data or {},
            inner=inner,
        )

        res = factory.handle(
            kind="workflow.submit",
            entity="action",
            payload=payload.model_dump(mode="json"),
            context={},
        )
        submit_result = SubmitResult.model_validate(_dump_json(res))
        log_events = list(submit_result.logEvents or [])
        wf = submit_result.workflow
        logger.info(
            "workflow.submit action_id=%s key=%s ok=%s stage=%s issues=%s log_events=%s",
            action_id,
            action.actionKey,
            submit_result.ok,
            wf.stageKey if wf else None,
            len(submit_result.issues or []),
            len(log_events),
        )

        # participantIds (даже если ok=False)
        new_pids = submit_result.participantIds or []
        tags = submit_result.workflow.tags or []
        action.participantIds = [x if isinstance(x, UUID) else UUID(str(x)) for x in new_pids]

        action.issues = submit_result.issues or []

        if not submit_result.ok:
            action.lastError = {"at": "submit", "issues": action.issues}
            actions[idx] = action
            await self._save_actions(actions)
            return True, ["actions"], action.model_dump(mode="json"), None

        # ok=True
        new_wf = submit_result.workflow
        action.workflow = new_wf.model_dump()
        action.tags = tags
        action.status = (action.workflow.get("status") if isinstance(action.workflow, dict) else None) or action.status

        extra_fields: list[str] = []
        if submit_result.sessionPatch is not None:
            patch = submit_result.sessionPatch
            action.sessionPatch = patch

            inner2, changed_fields = self._apply_session_patch_to_inner(inner, patch)
            if changed_fields:
                logger.info(
                    "sessionPatch applied action_id=%s fields=%s keys=%s",
                    action_id,
                    changed_fields,
                    sorted(k for k, v in (patch or {}).items() if v),
                )
            elif isinstance(patch, dict) and any(patch.values()):
                logger.warning(
                    "sessionPatch had entries but matched no entities action_id=%s keys=%s",
                    action_id,
                    sorted(k for k, v in patch.items() if v),
                )
            persisted = await self._persist_inner_fields(inner2, changed_fields)
            extra_fields += persisted

        action.can_close = submit_result.can_close

        actions[idx] = action
        await self._save_actions(actions)

        log_fields = await self._emit_action_side_effects(
            user,
            action,
            prev_status=prev_status,
            broadcasts=(res.get("broadcasts") or []) if isinstance(res, dict) else list(submit_result.broadcasts or []),
            log_events=log_events,
        )

        inner = await self._get_state()
        scene_id = payload.scene.id
        scene = next((s for s in inner.scenes if s.id == scene_id), None)
        # logger.info(f"!!!! {scene.data=}")
        await self._recompute_available_actions_for_scene(inner, scene)
        await self._save_scenes(inner.scenes)

        broadcasts = (res.get("broadcasts") or []) if isinstance(res, dict) else list(submit_result.broadcasts or [])
        return True, list(set(["actions", "scenes"] + extra_fields + log_fields)), action.model_dump(mode="json"), broadcasts

    @_serialized
    async def patch_action(
        self,
        user: models.User,
        *,
        action_id: UUID,
        input_data: dict[str, Any],
    ) -> Tuple[bool, list[str], Optional[dict[str, Any]]]:
        inner = await self._get_state()
        factory = self._get_factory(inner)

        actions = self._list_actions(inner)
        idx = self._find_action_index(actions, action_id)
        if idx < 0:
            return False, [], None

        action = actions[idx]
        payload = await self._build_action_context(
            action_key=action.actionKey,
            scene_id=action.scene_id,
            actor_user_id=user.id,
            participants=action.participants,
            workflow=action.workflow or {},
            input_data=input_data or {},
            inner=inner,
        )

        res = factory.handle(
            kind="workflow.patch",
            entity="action",
            payload=payload.model_dump(mode="json"),
            context={},
        )
        patch_result = SubmitResult.model_validate(_dump_json(res))
        wf = patch_result.workflow
        logger.info(
            "workflow.patch action_id=%s key=%s ok=%s stage=%s issues=%s",
            action_id,
            action.actionKey,
            patch_result.ok,
            wf.stageKey if wf else None,
            len(patch_result.issues or []),
        )

        new_pids = patch_result.participantIds or []
        action.participantIds = [x if isinstance(x, UUID) else UUID(str(x)) for x in new_pids]
        action.issues = patch_result.issues or []

        if not patch_result.ok:
            action.lastError = {"at": "patch", "issues": action.issues}
            actions[idx] = action
            await self._save_actions(actions)
            return True, ["actions"], action.model_dump(mode="json")

        prev_stage = (action.workflow or {}).get("stageKey")
        new_wf = patch_result.workflow.model_dump()
        if prev_stage and isinstance(new_wf, dict):
            new_wf["stageKey"] = prev_stage
        action.workflow = new_wf
        action.tags = patch_result.workflow.tags or action.tags
        actions[idx] = action
        await self._save_actions(actions)
        return True, ["actions"], action.model_dump(mode="json")


    @_serialized
    async def cancel_action(
        self,
        current_user: models.User,
        *,
        action_id: UUID,
        reason: Optional[str] = None,
    ) -> Tuple[bool, list[str]]:
        inner = await self._get_state()
        actions = self._list_actions(inner)
        idx = self._find_action_index(actions, action_id)
        if idx < 0:
            return False, []

        action = actions[idx]
        if action.status == "canceled":
            return True, ["actions"]

        master = getattr(inner, "master", None)
        master_id = getattr(master, "id", None) if master is not None else None
        if not user_may_cancel_action(
            user_id=current_user.id,
            master_id=master_id,
            action=action,
        ):
            logger.info(
                "cancel_action denied: user=%s action=%s",
                current_user.id,
                action_id,
            )
            return False, []

        action.status = "canceled"
        if isinstance(action.workflow, dict):
            wf2 = dict(action.workflow)
            wf2["status"] = "canceled"
            action.workflow = wf2

        action.participantIds = []
        action.lastError = {
            "at": "cancel",
            "issues": [{"byUserId": str(current_user.id), "reason": reason or ""}],
        }

        actions[idx] = action
        await self._save_actions(actions)
        return True, ["actions"]





    async def run_scene_action(
        self,
        current_user: models.User,
        scene_id: UUID,
        action_key: str,
    ) -> tuple[bool, list[str]]:
        inner = await self.get_inner()
        scene = next((s for s in (inner.scenes or []) if s.id == scene_id), None)
        if not scene:
            return False, []

        ok, fields, _action_obj = await self.create_action(
            current_user,
            action_key=action_key,
            scene_id=scene_id,
            params={"scene_id": scene_id},
        )
        if not ok:
            return False, []

        return True, list(set(fields + ["actions"]))

    async def submit_action_step(
        self,
        current_user: models.User,
        action_id: UUID,
        input_data: dict[str, Any],
    ) -> tuple[bool, list[str]]:
        ok, fields, action_obj, _broadcasts = await self.submit_action(
            current_user,
            action_id=action_id,
            input_data=input_data,
        )
        if not ok:
            return False, []

        return True, list(set(fields + ["actions"]))

    async def patch_action_step(
        self,
        current_user: models.User,
        action_id: UUID,
        input_data: dict[str, Any],
    ) -> tuple[bool, list[str]]:
        ok, fields, _action_obj = await self.patch_action(
            current_user,
            action_id=action_id,
            input_data=input_data,
        )
        if not ok:
            return False, []

        return True, list(set(fields + ["actions"]))
