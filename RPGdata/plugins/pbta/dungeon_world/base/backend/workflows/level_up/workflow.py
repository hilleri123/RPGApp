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

from .helpers import (
    can_level_up,
    move_options,
    skill_options,
    stat_options,
    xp_cost_for_level,
)
from .stages import LevelUpChooseStage, LevelUpReviewStage
from .types import LevelUpContext, LevelUpEntry


def _uniq(xs):
    out, seen = [], set()
    for x in xs:
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _user_id_for_character(links, character_id) -> str | None:
    mapping = getattr(links, "characterToUserId", None) or {}
    want = str(character_id)
    for cid, uid in mapping.items():
        if str(cid) == want:
            return str(uid)
    return None


def _character_for_user(scene, links, user_id):
    want = str(user_id)
    for ch in scene.characters or []:
        if _user_id_for_character(links, ch.id) == want:
            return ch
    return None


def _character_data(character) -> dict:
    raw = getattr(character, "data", None)
    if isinstance(raw, dict):
        return raw
    if isinstance(character, dict):
        d = character.get("data")
        return d if isinstance(d, dict) else {}
    return {}


class LevelUpWorkflow:
    key = "level_up"

    def __init__(self, full_codex):
        self.full_codex = full_codex
        self._stages = {
            LevelUpChooseStage.key: LevelUpChooseStage(full_codex),
            LevelUpReviewStage.key: LevelUpReviewStage(full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene, role: ActionRole) -> list[ActionInfo]:
        if role not in ("player", "gm"):
            return []

        any_ready = any(
            can_level_up(_character_data(ch))
            for ch in (scene.characters or [])
        )
        if not any_ready:
            return []

        return [ActionInfo(
            key=self.key,
            title="Повышение уровня",
            roles=["player", "gm"],
            description="Игрок выбирает бонусы, мастер подтверждает (параллельно по игрокам)",
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
            c = LevelUpContext.model_validate(wf.context or {})
            player_id = str(c.entry.player_user_id)
        except Exception:
            player_id = None

        stage = (wf.stageKey or "") if wf else ""
        if stage in ("level_up.result", "completed"):
            return []
        # Draft: only the player prepares — other players don't see it.
        if stage == LevelUpChooseStage.key:
            return _uniq([player_id])
        # Review / refine: player + GM.
        return _uniq([gm_id, player_id])

    def _build_workflow(
        self,
        *,
        scene,
        character,
        player_uid: str,
        stage_key: str,
    ) -> Workflow:
        data = _character_data(character)
        level = int(data.get("level") or 1)
        xp = int(data.get("xp") or 0)
        cost = xp_cost_for_level(level)
        stats = stat_options(self.full_codex, data)
        moves = move_options(self.full_codex, data)
        skills = skill_options(self.full_codex)

        blockers: list[str] = []
        if not can_level_up(data):
            blockers.append(f"Недостаточно XP (нужно {cost}, есть {xp})")
        if not moves:
            playbook_id = str(data.get("playbook_id") or data.get("playbook") or "")
            if not playbook_id:
                blockers.append("У персонажа не выбран playbook")
            else:
                blockers.append("Нет доступных advanced-ходов для выбора")
        if not any(s.get("can_increase") for s in stats):
            blockers.append("Все характеристики уже на максимуме (18)")

        entry = LevelUpEntry(
            player_user_id=UUID(str(player_uid)),
            character_id=UUID(str(character.id)),
            character_name=str(getattr(character, "name", None) or "") or "",
            level=level,
            xp=xp,
            xp_cost=cost,
        )
        ctx = LevelUpContext(scene_id=UUID(str(scene.id)), entry=entry)
        return Workflow(
            actionKey=self.key,
            stageKey=stage_key,
            status="active",
            context=ctx.model_dump(mode="json"),
            stageData={
                "characterName": entry.character_name,
                "characterId": str(entry.character_id),
                "playbookId": str(data.get("playbook_id") or data.get("playbook") or ""),
                "level": level,
                "xp": xp,
                "xpCost": cost,
                "nextLevel": level + 1,
                "stats": stats,
                "moves": moves,
                "skills": skills,
                "canLevelUp": can_level_up(data),
                "blockers": blockers,
                "awaitingGm": stage_key == LevelUpReviewStage.key,
            },
        )

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        scene = action_context.scene
        actor_id = action_context.actorUserId
        gm_id = action_context.participants.gmUserId
        links = action_context.links
        params = action_context.input if isinstance(action_context.input, dict) else {}

        character = None
        player_uid = None
        started_by_gm = False
        if actor_id == gm_id and params.get("character_id"):
            started_by_gm = True
            character = next(
                (ch for ch in (scene.characters or []) if str(ch.id) == str(params["character_id"])),
                None,
            )
            if character:
                player_uid = _user_id_for_character(links, character.id) or str(gm_id)
        else:
            character = _character_for_user(scene, links, actor_id)
            player_uid = str(actor_id) if character else None

        if character is not None and player_uid is not None:
            # GM starting for a character goes straight to review (can fill + approve).
            stage_key = LevelUpReviewStage.key if started_by_gm else LevelUpChooseStage.key
            wf = self._build_workflow(
                scene=scene,
                character=character,
                player_uid=player_uid,
                stage_key=stage_key,
            )
            return self._rb.result(
                ok=True,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[],
            )

        wf = Workflow(
            actionKey=self.key,
            stageKey=LevelUpChooseStage.key,
            status="canceled",
            context={
                "scene_id": str(scene.id),
                "entry": {
                    "player_user_id": str(actor_id),
                    "character_id": str(params.get("character_id") or "00000000-0000-0000-0000-000000000000"),
                    "character_name": "",
                    "level": 1,
                    "xp": 0,
                    "xp_cost": 8,
                },
            },
            stageData={"blockers": ["Character not found for level_up"]},
        )
        return self._rb.result(
            ok=False,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[issue("actor", "Character not found for level_up")],
        )

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        if wf is None:
            return self._rb.result(
                ok=False,
                wf=Workflow(actionKey=self.key, stageKey="", status="canceled"),
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("workflow", "Missing")],
            )

        stage_key = wf.stageKey or ""
        st = self._stages.get(stage_key)
        if st is None:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
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
                ok=False,
                wf=Workflow(actionKey=self.key, stageKey="", status="canceled"),
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("workflow", "Missing")],
            )
        try:
            c = LevelUpContext.model_validate(wf.context or {})
        except Exception as e:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("context", str(e))],
            )

        uid = str(action_context.actorUserId)
        gm_id = str(participants.gmUserId)
        player_id = str(c.entry.player_user_id)
        stage = wf.stageKey or ""

        if stage == LevelUpChooseStage.key and uid != player_id:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Only the player can edit the level-up draft")],
            )
        if stage == LevelUpReviewStage.key and uid not in (gm_id, player_id):
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Only player or GM can patch level-up review")],
            )
        # On review, only GM may change the draft (player just watches).
        if stage == LevelUpReviewStage.key and uid != gm_id:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Only GM can refine the level-up on review")],
            )

        inp = action_context.input or {}
        if "stat_id" in inp:
            c.entry.chosen_stat_id = str(inp.get("stat_id") or "") or None
        if "move_id" in inp:
            c.entry.chosen_move_id = str(inp.get("move_id") or "") or None
        if "custom_move" in inp:
            raw = inp.get("custom_move")
            c.entry.custom_move = raw if isinstance(raw, dict) else None
        wf.context = c.model_dump(mode="json")
        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )
