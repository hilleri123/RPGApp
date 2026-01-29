from __future__ import annotations

from typing import Any
from pydantic import ValidationError

from .types import (
    ACTION_TO_ATTRIBUTE,
    Workflow, StageEnvelope, UiSpec, SubmitResult, PreRollConfirmInput,
    ChooseActionInput, GmSetInput, PlayerModsInput, GmFinalizeInput,
    MitigateInput, ResistInput, WrapUpInput, AssistConfirmInput,
)
from .dice import roll_d6, outcome_from, best_and_crit
from .scene import (
    find_character_ref, character_data, character_name,
    action_rating, attribute_rating, get_stress,
)

from ..action_participants import ActionParticipants  # как у тебя


def _issue(path: str, message: str, level: str = "error") -> dict[str, Any]:
    return {"path": path, "message": message, "level": level}


def _dump(m):
    return m.model_dump(mode="json") if hasattr(m, "model_dump") else m.dict()


class RollActionWorkflow:
    key = "blades.roll_action"

    def start(self, scene: dict[str, Any]) -> Workflow:
        wf = Workflow()
        wf.stageKey = "choose_action"
        wf.context = {
            "character_id": None,
            "selectedAction": None,
            "item_id": None,

            "position": None,
            "effect": None,
            "consequence_hint": None,

            "mods": {
                "push": False,
                "help": False,
                "devils_bargain": False,
                "bonus_dice": 0,
            },

            "roll": None,
            "consequences": None,   # placeholder for future
            "resist": None,

            "summary": None,
        }
        return wf

    # ---------- present ----------

    def present(
        self,
        scene: dict[str, Any],
        actor_user_id: str,
        participants_dict: dict[str, Any],
        wf_dict: dict[str, Any],
    ) -> StageEnvelope:
        wf = Workflow.model_validate(wf_dict) if hasattr(Workflow, "model_validate") else Workflow.parse_obj(wf_dict)
        _ = ActionParticipants.model_validate(participants_dict) if hasattr(ActionParticipants, "model_validate") else ActionParticipants.parse_obj(participants_dict)

        if wf.stageKey == "choose_action":
            return StageEnvelope(
                audience=[{"kind": "initiator"}],
                stageKey=wf.stageKey,
                stageData=wf.stageData,
                ui=UiSpec(
                    component="blades.RollAction.ChooseAction",
                    props={
                        "actions": list(ACTION_TO_ATTRIBUTE.keys()),
                        "actionGroups": [
                            {"key": "insight", "name": "Insight", "color": "#60a5fa", "actions": ["hunt","study","survey","tinker"]},
                            {"key": "prowess", "name": "Prowess", "color": "#34d399", "actions": ["finesse","prowl","skirmish","wreck"]},
                            {"key": "resolve", "name": "Resolve", "color": "#f472b6", "actions": ["attune","command","consort","sway"]},
                        ],
                    },
                ),
            )

        if wf.stageKey == "gm_set_position_effect":
            return StageEnvelope(
                audience=[{"kind": "gm"}],
                stageKey=wf.stageKey,
                stageData={
                    "selectedAction": wf.context.get("selectedAction"),
                    "character_id": wf.context.get("character_id"),
                },
                ui=UiSpec(
                    component="blades.RollAction.GmSetPositionEffect",
                    props={
                        "positions": ["controlled", "risky", "desperate"],
                        "effects": ["limited", "standard", "great"],
                    },
                ),
            )

        if wf.stageKey == "player_add_mods":
            return StageEnvelope(
                audience=[{"kind": "initiator"}],
                stageKey=wf.stageKey,
                stageData={
                    "selectedAction": wf.context.get("selectedAction"),
                    "position": wf.context.get("position"),
                    "effect": wf.context.get("effect"),
                    "consequence_hint": wf.context.get("consequence_hint"),
                    "mods": wf.context.get("mods") or {},
                },
                ui=UiSpec(component="blades.RollAction.PlayerAddMods", props={}),
            )
        
        if wf.stageKey == "assist_confirm":
            helper_user_id = (wf.context.get("mods") or {}).get("helper_user_id")
            return StageEnvelope(
                audience=[{"kind": "user", "user_id": helper_user_id}],
                stageKey=wf.stageKey,
                stageData={
                    "selectedAction": wf.context.get("selectedAction"),
                    "character_id": wf.context.get("character_id"),
                },
                ui=UiSpec(component="blades.RollAction.AssistConfirm", props={}),
            )


        if wf.stageKey == "gm_finalize":
            return StageEnvelope(
                audience=[{"kind": "gm"}],
                stageKey=wf.stageKey,
                stageData={
                    "selectedAction": wf.context.get("selectedAction"),
                    "character_id": wf.context.get("character_id"),
                    "position": wf.context.get("position"),
                    "effect": wf.context.get("effect"),
                    "consequence_hint": wf.context.get("consequence_hint"),
                    "mods": wf.context.get("mods") or {},
                },
                ui=UiSpec(component="blades.RollAction.GmFinalize", props={}),
            )

        if wf.stageKey == "prerollconfirm":
            return StageEnvelope(
                audience=[{"kind": "initiator"}],
                stageKey=wf.stageKey,
                stageData={
                    "selectedAction": wf.context.get("selectedAction"),
                    "character_id": wf.context.get("character_id"),
                    "position": wf.context.get("position"),
                    "effect": wf.context.get("effect"),
                    "consequence_hint": wf.context.get("consequence_hint"),
                    "mods": wf.context.get("mods") or {},
                },
                ui=UiSpec(component="blades.RollAction.PreRollConfirm", props={}),
            )

        if wf.stageKey == "mitigate":
            return StageEnvelope(
                audience=[{"kind": "initiator"}],
                stageKey=wf.stageKey,
                stageData={
                    "selectedAction": wf.context.get("selectedAction"),
                    "position": wf.context.get("position"),
                    "effect": wf.context.get("effect"),
                    "consequence_hint": wf.context.get("consequence_hint"),
                    "roll": wf.context.get("roll") or {},
                },
                ui=UiSpec(component="blades.RollAction.Mitigate", props={}),
            )

        if wf.stageKey == "resist":
            return StageEnvelope(
                audience=[{"kind": "gm"}],
                stageKey=wf.stageKey,
                stageData={
                    "roll": wf.context.get("roll") or {},
                    "consequence_hint": wf.context.get("consequence_hint"),
                },
                ui=UiSpec(
                    component="blades.RollAction.Resist",
                    props={"attributes": ["insight", "prowess", "resolve"]},
                ),
            )


        if wf.stageKey == "wrap_up":
            return StageEnvelope(
                audience=[{"kind": "gm"}],
                stageKey=wf.stageKey,
                stageData={
                    "roll": wf.context.get("roll") or {},
                    "resist": wf.context.get("resist"),
                    "summary": wf.context.get("summary"),
                },
                ui=UiSpec(component="blades.RollAction.WrapUp", props={}),
            )

        return StageEnvelope(audience=[{"kind": "all"}], stageKey="done", stageData={}, ui=None, broadcasts=[])

    # ---------- submit ----------

    def submit(
        self,
        scene: dict[str, Any],
        actor_user_id: str,
        participants_dict: dict[str, Any],
        wf_dict: dict[str, Any],
        input_dict: dict[str, Any],
    ) -> SubmitResult:
        try:
            wf = Workflow.model_validate(wf_dict) if hasattr(Workflow, "model_validate") else Workflow.parse_obj(wf_dict)
        except ValidationError as e:
            return SubmitResult(ok=False, issues=[_issue("workflow", str(e))])

        try:
            participants = ActionParticipants.model_validate(participants_dict) if hasattr(ActionParticipants, "model_validate") else ActionParticipants.parse_obj(participants_dict)
        except ValidationError as e:
            return SubmitResult(ok=False, issues=[_issue("participants", str(e))])

        if wf.status != "active":
            return SubmitResult(ok=False, issues=[_issue("", "Workflow is not active")])

        # helpers: current character
        def _get_char():
            cid = wf.context.get("character_id")
            if not cid:
                return {}, {}
            ch_ref = find_character_ref(scene, str(cid))
            return ch_ref, character_data(ch_ref)

        # 1) choose_action
        if wf.stageKey == "choose_action":
            if not participants.has(actor_user_id, "initiator"):
                return SubmitResult(ok=False, issues=[_issue("", "Only initiator can choose action")])

            try:
                inp = ChooseActionInput.model_validate(input_dict) if hasattr(ChooseActionInput, "model_validate") else ChooseActionInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[_issue("input", str(e))])

            ch_ref = find_character_ref(scene, inp.character_id)
            if not ch_ref:
                return SubmitResult(ok=False, issues=[_issue("input.character_id", "Character not found in scene")])

            wf.context["character_id"] = inp.character_id
            wf.context["selectedAction"] = inp.action
            wf.context["item_id"] = inp.item_id

            wf.context["position"] = None
            wf.context["effect"] = None
            wf.context["consequence_hint"] = None
            wf.context["mods"] = {"push": False, "help": False, "devils_bargain": False, "bonus_dice": 0}

            wf.context["roll"] = None
            wf.context["resist"] = None
            wf.context["summary"] = None

            wf.stageKey = "gm_set_position_effect"
            return SubmitResult(ok=True, workflow=_dump(wf))

        # 2) gm_set_position_effect
        if wf.stageKey == "gm_set_position_effect":
            if not participants.has(actor_user_id, "gm"):
                return SubmitResult(ok=False, issues=[_issue("", "Only GM can set position/effect")])

            try:
                inp = GmSetInput.model_validate(input_dict) if hasattr(GmSetInput, "model_validate") else GmSetInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[_issue("input", str(e))])

            wf.context["position"] = inp.position
            wf.context["effect"] = inp.effect
            wf.context["consequence_hint"] = inp.consequence_hint or ""

            wf.stageKey = "player_add_mods"
            return SubmitResult(ok=True, workflow=_dump(wf))

        # 3) player_add_mods
        if wf.stageKey == "player_add_mods":
            if not participants.has(actor_user_id, "initiator"):
                return SubmitResult(ok=False, issues=[_issue("", "Only initiator can add mods")])

            try:
                inp = PlayerModsInput.model_validate(input_dict) if hasattr(PlayerModsInput, "model_validate") else PlayerModsInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[_issue("input", str(e))])

            if inp.push and inp.devils_bargain:
                return SubmitResult(ok=False, issues=[_issue("input", "Нельзя одновременно Push Yourself и Сделку с дьяволом")])

            if inp.help and not inp.helper_user_id:
                return SubmitResult(ok=False, issues=[_issue("input.helper_user_id", "Нужно выбрать помогающего")])

            wf.context["mods"] = {
                "push": bool(inp.push),
                "help": bool(inp.help),
                "helper_user_id": inp.helper_user_id,
                "devils_bargain": bool(inp.devils_bargain),
                "bonus_dice": max(0, int(inp.bonus_dice)),
                "help_confirmed": False,
            }

            if inp.help:
                wf.stageKey = "assist_confirm"
            else:
                wf.stageKey = "gm_finalize"

            return SubmitResult(ok=True, workflow=_dump(wf))

        if wf.stageKey == "assist_confirm":
            mods = wf.context.get("mods") or {}
            helper_user_id = mods.get("helper_user_id")
            if not helper_user_id or str(helper_user_id) != str(actor_user_id):
                return SubmitResult(ok=False, issues=[_issue("", "Only selected helper can confirm help")])

            try:
                inp = AssistConfirmInput.model_validate(input_dict) if hasattr(AssistConfirmInput, "model_validate") else AssistConfirmInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[_issue("input", str(e))])

            if not inp.accept_help:
                # помощник отказал => снимаем help
                mods["help"] = False
                mods["helper_user_id"] = None
                mods["help_confirmed"] = False
                wf.context["mods"] = mods
                wf.stageKey = "gm_finalize"
                return SubmitResult(ok=True, workflow=_dump(wf))

            mods["help_confirmed"] = True
            wf.context["mods"] = mods
            wf.stageKey = "gm_finalize"
            return SubmitResult(ok=True, workflow=_dump(wf))


        # 4) gm_finalize
        if wf.stageKey == "gm_finalize":
            if not participants.has(actor_user_id, "gm"):
                return SubmitResult(ok=False, issues=[_issue("", "Only GM can finalize")])

            try:
                inp = GmFinalizeInput.model_validate(input_dict) if hasattr(GmFinalizeInput, "model_validate") else GmFinalizeInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[_issue("input", str(e))])

            if not inp.allow:
                wf.stageKey = "choose_action"
                return SubmitResult(ok=True, workflow=_dump(wf))

            # overrides
            if inp.action:
                wf.context["selectedAction"] = inp.action
            # item_id: мастер может и задать, и снять (None)
            if "item_id" in input_dict:
                wf.context["item_id"] = inp.item_id

            if inp.position:
                wf.context["position"] = inp.position
            if inp.effect:
                wf.context["effect"] = inp.effect
            if inp.consequence_hint is not None:
                wf.context["consequence_hint"] = inp.consequence_hint

            wf.stageKey = "prerollconfirm"
            return SubmitResult(ok=True, workflow=_dump(wf))

        # 5) roll
        # 5) prerollconfirm
        if wf.stageKey == "prerollconfirm":
            if not participants.has(actor_user_id, "initiator"):
                return SubmitResult(ok=False, issues=[_issue("", "Only initiator can confirm pre-roll")])

            try:
                inp = PreRollConfirmInput.model_validate(input_dict) if hasattr(PreRollConfirmInput, "model_validate") else PreRollConfirmInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[_issue("input", str(e))])

            if not inp.choice == "accept":
                # вернуть в начало (как ты хотел)
                wf.stageKey = "choose_action"

                # опционально: подчистить, чтобы точно было "с нуля"
                wf.context["position"] = None
                wf.context["effect"] = None
                wf.context["consequence_hint"] = None
                wf.context["mods"] = {"push": False, "help": False, "devils_bargain": False, "bonus_dice": 0}
                wf.context["roll"] = None
                wf.context["roll_broadcasts"] = []
                wf.context["resist"] = None
                wf.context["resist_broadcasts"] = []
                wf.context["summary"] = None

                return SubmitResult(ok=True, workflow=_dump(wf))

            # --- ACCEPT => делаем бросок прямо тут (бывший код из stage 'roll')
            action = wf.context.get("selectedAction")
            if action not in ACTION_TO_ATTRIBUTE:
                return SubmitResult(ok=False, issues=[_issue("context.selectedAction", "Action not selected")])

            ch_ref, ch_data = _get_char()
            if not ch_ref:
                return SubmitResult(ok=False, issues=[_issue("context.character_id", "Character not found in scene")])

            base = action_rating(ch_data, action)

            mods = wf.context.get("mods") or {}
            bonus = 0
            if mods.get("push"):
                bonus += 1
            if mods.get("help") and mods.get("help_confirmed"):
                bonus += 1
            if mods.get("devils_bargain"):
                bonus += 1
            try:
                bonus += max(0, int(mods.get("bonus_dice") or 0))
            except Exception:
                pass

            pool = base + bonus
            rolls = roll_d6(pool)
            out, crit, best = outcome_from(rolls)

            wf.context["roll"] = {
                "character_id": wf.context.get("character_id"),
                "character_name": character_name(ch_ref),
                "action": action,
                "base": base,
                "bonus": bonus,
                "pool": pool,
                "rolls": rolls,
                "best": best,
                "crit": crit,
                "outcome": out,
                "position": wf.context.get("position"),
                "effect": wf.context.get("effect"),
            }

            wf.context["roll_broadcasts"] = [{
                "type": "dice.roll",
                "subtype": "action",
                **(wf.context["roll"]),
            }]

            # if out in ("bad", "mixed"):
            #     wf.stageKey = "mitigate"
            # else:
            #     wf.stageKey = "wrap_up"
            wf.stageKey = "mitigate"

            return SubmitResult(ok=True, workflow=_dump(wf), broadcasts=wf.context.get("roll_broadcasts") or [])

        # 6) mitigate
        if wf.stageKey == "mitigate":
            if not participants.has(actor_user_id, "initiator"):
                return SubmitResult(ok=False, issues=[_issue("", "Only initiator can mitigate")])

            try:
                inp = MitigateInput.model_validate(input_dict) if hasattr(MitigateInput, "model_validate") else MitigateInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[_issue("input", str(e))])

            if inp.choice == "accept":
                wf.stageKey = "wrap_up"
                return SubmitResult(ok=True, workflow=_dump(wf))

            wf.stageKey = "resist"
            return SubmitResult(ok=True, workflow=_dump(wf))

        # 7) resist  (GM выбирает атрибут, система кидает)
        if wf.stageKey == "resist":
            if not participants.has(actor_user_id, "gm"):
                return SubmitResult(ok=False, issues=[_issue("", "Only GM can choose resistance attribute")])

            try:
                inp = ResistInput.model_validate(input_dict) if hasattr(ResistInput, "model_validate") else ResistInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[_issue("input", str(e))])

            if not inp.confirm:
                wf.stageKey = "wrap_up"
                return SubmitResult(ok=True, workflow=_dump(wf))

            ch_ref, ch_data = _get_char()
            if not ch_ref:
                return SubmitResult(ok=False, issues=[_issue("context.character_id", "Character not found in scene")])

            attr = inp.attribute
            pool = attribute_rating(ch_data, ACTION_TO_ATTRIBUTE, attr)  # у тебя уже так устроен helper [file:28]
            rolls = roll_d6(pool)

            best, is_crit = best_and_crit(rolls)
            stress_cost = max(0, 6 - best)

            # по правилам: крит на сопротивлении = очистить 1 stress (т.е. -1 к цене, минимум 0)
            if is_crit:
                stress_cost = max(0, stress_cost - 1)

            wf.context["resist"] = {
                "attribute": attr,
                "pool": pool,
                "rolls": rolls,
                "best": best,
                "crit": bool(is_crit),
                "stressCost": stress_cost,
            }

            wf.context["resist_broadcasts"] = [{
                "type": "dice.roll",
                "subtype": "resistance",
                **(wf.context["resist"]),
            }]

            old_stress = get_stress(ch_data)
            new_stress = old_stress + stress_cost

            mods = wf.context.get("mods") or {}
            if mods.get("push"):
                new_stress += 2

            session_patch = {
                "characters": [
                    {"id": wf.context.get("character_id"), "data": {"stress": new_stress}}
                ]
            }

            wf.stageKey = "wrap_up"
            return SubmitResult(
                ok=True,
                workflow=_dump(wf),
                broadcasts=wf.context.get("resist_broadcasts") or [],
                sessionPatch=session_patch,
            )


        # 8-9) wrap_up (мастер может дописать summary/trauma)
        if wf.stageKey == "wrap_up":
            if not participants.has(actor_user_id, "gm"):
                return SubmitResult(ok=False, issues=[_issue("", "Only GM can wrap up")])

            try:
                inp = WrapUpInput.model_validate(input_dict) if hasattr(WrapUpInput, "model_validate") else WrapUpInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[_issue("input", str(e))])

            if inp.summary is not None:
                wf.context["summary"] = inp.summary
            if inp.trauma is not None:
                # тут можно тоже сделать sessionPatch: добавить травму
                wf.context["trauma"] = inp.trauma

            wf.stageKey = "done"
            wf.status = "completed"
            return SubmitResult(ok=True, workflow=_dump(wf))

        return SubmitResult(ok=False, issues=[_issue("", "Unknown stage")])
