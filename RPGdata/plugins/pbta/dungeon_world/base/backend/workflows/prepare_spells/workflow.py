from __future__ import annotations

from uuid import UUID

from plugins.common.types import (
    ActionParticipants,
    ActionContext,
    ActionRole,
    Workflow,
    SubmitResult,
    ActionInfo,
)
from plugins.common.protocols import ResultBuilder, StageCtx, issue

from .stages import PrepareSpellsDraftStage, PrepareSpellsReviewStage
from .types import PrepareSpellsContext, PrepareSpellsEntry


def _uniq(xs):
    out, seen = [], set()
    for x in xs:
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out


PREPARE_ONLY_IN_CAMP = "Подготовить заклинания можно только в лагере"


def prepare_allowed(scene_data: dict | None) -> bool:
    """Заучивание заклинаний — ход лагеря; в пути и в действии недоступно."""
    from ...scene_context import normalize_scene_mode

    return normalize_scene_mode((scene_data or {}).get("mode")) == "camp"


def can_prepare_spells(data: dict | None) -> bool:
    """True if character has at least one owned spell entry with an id."""
    d = data if isinstance(data, dict) else {}
    spells = (d.get("spellcasting") or {}).get("spells") or []
    return any(isinstance(s, dict) and s.get("id") for s in spells)


def _character_data(character) -> dict:
    raw = getattr(character, "data", None)
    if isinstance(raw, dict):
        return raw
    if isinstance(character, dict):
        d = character.get("data")
        return d if isinstance(d, dict) else {}
    return {}


class PrepareSpellsWorkflow:
    key = "prepare_spells"

    def __init__(self, full_codex):
        self.full_codex = full_codex
        self._stages = {
            PrepareSpellsDraftStage.key: PrepareSpellsDraftStage(full_codex),
            PrepareSpellsReviewStage.key: PrepareSpellsReviewStage(full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene, role: ActionRole) -> list[ActionInfo]:
        if role not in ("player", "gm"):
            return []
        if not prepare_allowed(getattr(scene, "data", None)):
            return []
        any_ready = any(
            can_prepare_spells(_character_data(ch))
            for ch in (scene.characters or [])
        )
        if not any_ready:
            return []
        return [ActionInfo(
            key=self.key,
            title="Подготовить заклинания",
            roles=["player", "gm"],
            description="Заучивание: отметить prepared, мастер подтверждает",
        )]

    def _participants_fallback_ids(self, d: dict) -> list[str]:
        ids = []
        if gm := (d or {}).get("gmUserId"):
            ids.append(str(gm))
        for u in (d or {}).get("participants") or []:
            ids.append(str(u))
        return _uniq(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        gm_id = str(participants.gmUserId)
        try:
            c = PrepareSpellsContext.model_validate(wf.context or {})
            player_id = str(c.entry.player_user_id)
        except Exception:
            player_id = None
        return _uniq([gm_id, player_id])

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        scene = action_context.scene
        actor_id = action_context.actorUserId
        gm_id = action_context.participants.gmUserId
        links = action_context.links
        params = action_context.input if isinstance(action_context.input, dict) else {}

        if not prepare_allowed(getattr(scene, "data", None)):
            return self._rb.result(
                ok=False, wf=None, participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("scene", PREPARE_ONLY_IN_CAMP)],
            )

        character = None
        if actor_id == gm_id and params.get("character_id"):
            character = next(
                (ch for ch in (scene.characters or []) if str(ch.id) == str(params["character_id"])),
                None,
            )
            player_uid = links.characterToUserId.get(character.id) if character else None
        else:
            character = next(
                (ch for ch in (scene.characters or [])
                 if links.characterToUserId.get(ch.id) == actor_id),
                None,
            )
            player_uid = actor_id

        if character is None or player_uid is None:
            return self._rb.result(
                ok=False, wf=None, participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("actor", "Character not found for prepare_spells")],
            )

        data = character.data if isinstance(character.data, dict) else {}
        spells = list((data.get("spellcasting") or {}).get("spells") or [])

        spells_map: dict = {}
        cantrip_note = ""
        try:
            spells_map = self.full_codex.spells.spells_map() or {}
        except Exception:
            spells_map = {}
        playbook_id = str(data.get("playbook_id") or data.get("playbook") or "")
        try:
            for book in self.full_codex.spells.get_spell_books() or []:
                if str(getattr(book, "class_id", "") or "") == playbook_id:
                    cantrip_note = str(getattr(book, "cantrip_note", "") or "")
                    break
        except Exception:
            pass

        draft = []
        for s in spells:
            if not isinstance(s, dict) or not s.get("id"):
                continue
            spell_id = str(s.get("spell_id") or "")
            codex = spells_map.get(spell_id)
            school = str(getattr(codex, "school", None) or s.get("school") or "")
            description = str(
                getattr(codex, "description", None)
                or s.get("description")
                or ""
            )
            tags = list(getattr(codex, "tags", None) or s.get("tags") or [])
            level = int(s.get("level") if s.get("level") is not None else (getattr(codex, "level", 0) or 0))
            is_cantrip = school == "фокус"
            draft.append({
                "id": str(s.get("id") or ""),
                "spell_id": spell_id,
                "prepared": bool(s.get("prepared")),
                "amount": int(s.get("amount") or 1),
                "title": str(s.get("title") or getattr(codex, "title", None) or spell_id or ""),
                "level": level,
                "school": school,
                "description": description,
                "tags": [str(t) for t in tags],
                "is_cantrip": is_cantrip,
            })

        # Фокусы всегда подготовлены по умолчанию (DW). amount для подготовки не важен.
        for item in draft:
            if item.get("is_cantrip"):
                item["prepared"] = True
            item["amount"] = 1

        cantrip_total = sum(1 for x in draft if x.get("is_cantrip"))
        cantrip_codex = 0
        try:
            cantrip_codex = sum(
                1
                for sp in (spells_map.values() if isinstance(spells_map, dict) else [])
                if playbook_id in (getattr(sp, "classes", None) or [])
                and str(getattr(sp, "school", "") or "") == "фокус"
            )
        except Exception:
            cantrip_codex = 0

        entry = PrepareSpellsEntry(
            player_user_id=UUID(str(player_uid)),
            character_id=UUID(str(character.id)),
            character_name=str(getattr(character, "name", "") or ""),
            prepared_draft=draft,
        )
        ctx = PrepareSpellsContext(scene_id=UUID(str(scene.id)), entry=entry)
        wf = Workflow(
            actionKey=self.key,
            stageKey=PrepareSpellsDraftStage.key,
            status="active",
            context=ctx.model_dump(mode="json"),
            stageData={
                "spells": spells,
                "characterName": entry.character_name,
                "levelBudget": int(data.get("level") or 1) + 1,
                "playbookId": playbook_id,
                "cantripNote": cantrip_note or (
                    "Фокусы готовятся при каждой подготовке и не входят в сумму уровней."
                ),
                "cantripOwned": cantrip_total,
                "cantripInCodex": cantrip_codex,
            },
        )

        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        if wf is None:
            return self._rb.result(
                ok=False, wf=None, participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("workflow", "Missing")],
            )

        stage_key = wf.stageKey or ""
        st = self._stages.get(stage_key)
        if st is None:
            return self._rb.result(
                ok=False, wf=wf, participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("stageKey", f"Unknown stage: {stage_key}")],
            )

        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )
        return st.submit(wf, ctx, action_context.input or {})

    def patch(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        if wf is None:
            return self._rb.result(
                ok=False, wf=None, participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("workflow", "Missing")],
            )
        try:
            c = PrepareSpellsContext.model_validate(wf.context or {})
        except Exception as e:
            return self._rb.result(
                ok=False, wf=wf, participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("context", str(e))],
            )
        draft = (action_context.input or {}).get("prepared_draft")
        if isinstance(draft, list):
            c.entry.prepared_draft = draft
            wf.context = c.model_dump(mode="json")
        return self._rb.result(
            ok=True, wf=wf, participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )
