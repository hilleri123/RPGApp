from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..engine import roll_damage_claim
from ..helpers import collect_participating_factories, damage_quick_options, moves_map_for_workflow, primary_move_id
from ..manifest_sync import (
    STAGE_KEY,
    assign_claim_rollers,
    prefill_manifest_from_entry,
    read_manifest,
    sync_claims_to_manifest_lines,
    sync_manifest_lines_to_entry,
    write_manifest,
)
from ..stage_store import DwStage
from ..types import PerformMoveContext
from ..types_change_manifest import ChangeManifestState


COMPLICATION_MAX_LEN = 500
PARTIAL_OUTCOME = "hit_7_9"


def complication_reasons(entry: Any) -> list[str]:
    """Поводы для поля «Косяк»: частичный успех или к6 выше к8 у аппетитов."""
    roll = getattr(entry, "roll", None)
    reasons: list[str] = []
    if getattr(roll, "outcome", None) == PARTIAL_OUTCOME:
        reasons.append("7–9")
    if getattr(roll, "appetite_complication", False):
        reasons.append("к6 выше к8")
    return reasons


def is_gm(ctx: StageCtx) -> bool:
    return str(ctx.actor_user_id) == str(ctx.participants.gmUserId)


def clean_complication(text: Any) -> str:
    return " ".join(str(text or "").split())[:COMPLICATION_MAX_LEN]


def _owner_map(links) -> dict[str, str]:
    raw = getattr(links, "characterToUserId", None)
    if raw is None and isinstance(links, dict):
        raw = links.get("characterToUserId") or {}
    return {str(k): str(v) for k, v in (raw or {}).items() if k and v}


def _roller_user_id(line: dict, owners: dict[str, str]) -> str:
    payload = line.get("payload") if isinstance(line.get("payload"), dict) else {}
    target = line.get("target") if isinstance(line.get("target"), dict) else {}
    source_kind = str(payload.get("source_kind") or "")
    source_id = str(payload.get("source_id") or "")
    target_kind = str(target.get("kind") or "")
    target_id = str(target.get("id") or "")
    if source_kind == "character" and owners.get(source_id):
        return owners[source_id]
    if target_kind == "character":
        return owners.get(target_id, "")
    return ""


def stamp_line_rollers(lines: list, links) -> list:
    """Игрок персонажа, с которым связана заявка, сразу становится её получателем."""
    owners = _owner_map(links)
    out: list = []
    for raw in lines:
        if not isinstance(raw, dict):
            out.append(raw)
            continue
        line = dict(raw)
        if line.get("kind") == "damage" and line.get("status") != "skipped":
            payload = dict(line.get("payload") or {})
            uid = _roller_user_id(line, owners)
            if uid:
                payload["roller_user_id"] = uid
            line["payload"] = payload
        out.append(line)
    return out


def _finish_block(lines) -> str | None:
    for line in lines:
        if getattr(line, "kind", None) != "damage" or line.status == "skipped":
            continue
        if line.status == "pending":
            return "Есть заявка, которую мастер ещё не подтвердил"
        if line.status == "needs_roll":
            return "Сначала бросок игрока"
    return None


def _reconcile_lines(previous: list, incoming: list, *, gm: bool, user_id: str) -> list:
    """Игрок добавляет черновик. Мастерская строка сразу одобрена. Чужие строки игрок не стирает."""
    old = {str(item.get("id")): item for item in previous if isinstance(item, dict)}
    seen: set[str] = set()
    out: list = []
    for raw in incoming:
        if not isinstance(raw, dict):
            continue
        line = dict(raw)
        lid = str(line.get("id") or "")
        seen.add(lid)
        prev = old.get(lid)
        payload = dict(line.get("payload") or {})
        kind = line.get("kind")
        if gm:
            if line.get("status") == "skipped":
                status = "skipped"
            elif kind == "damage" and (line.get("status") == "rolled" or payload.get("rolled")):
                status = "rolled"
            elif kind == "damage":
                status = "needs_roll"
            else:
                status = line.get("status") or "draft"
            payload["declared_by"] = user_id if prev is None else str((prev.get("payload") or {}).get("declared_by") or user_id)
            line["payload"] = payload
            line["status"] = status
            out.append(line)
            continue
        if prev is None:
            payload["declared_by"] = user_id
            line["payload"] = payload
            line["status"] = "pending" if kind == "damage" else "draft"
            out.append(line)
            continue
        declared = str((prev.get("payload") or {}).get("declared_by") or "")
        if prev.get("status") in ("needs_roll", "rolled", "applied", "skipped") or declared != user_id:
            out.append(prev)
            continue
        payload["declared_by"] = declared or user_id
        line["payload"] = payload
        line["status"] = "pending" if kind == "damage" else (line.get("status") or "draft")
        out.append(line)
    if not gm:
        for lid, prev in old.items():
            if lid in seen:
                continue
            declared = str((prev.get("payload") or {}).get("declared_by") or "")
            if prev.get("status") in ("needs_roll", "rolled", "applied") or declared != user_id:
                out.append(prev)
    return out


class ManifestPatchInput(BaseModel):
    gm_complication: str | None = None
    mode: str | None = None
    lines: list[dict[str, Any]] | None = None
    editing_line_id: str | None = None
    editing_step: str | None = None
    unprepare_cast_spell: bool | None = None
    commit_roll: dict[str, Any] | None = None


class ManifestSubmitInput(BaseModel):
    gm_complication: str | None = None
    action: str = "continue"  # continue | apply
    lines: list[dict[str, Any]] | None = None
    mode: str | None = None
    unprepare_cast_spell: bool | None = None


class PerformMoveChangeManifestStage(DwStage):
    key = STAGE_KEY

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        if wf is not None:
            write_manifest(wf, ChangeManifestState())

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        parsed = ctx.rb.parse_input(ManifestPatchInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        cur = read_manifest(wf).model_dump(mode="json")
        gm = is_gm(ctx)
        if cur.get("mode") == "review" and not gm:
            return StageOutcome.fail("", "На проверке заявку правит только мастер")
        if parsed.gm_complication is not None:
            problem = self._complication_problem(wf, ctx)
            if problem:
                return StageOutcome.fail("gm_complication", problem)
        if parsed.mode is not None:
            cur["mode"] = parsed.mode
        if parsed.lines is not None:
            cur["lines"] = list(parsed.lines)
        if parsed.commit_roll is not None:
            problem = self._roll_problem(wf, ctx, parsed.commit_roll)
            if problem:
                return StageOutcome.fail("commit_roll", problem)
            cur["commit_roll"] = dict(parsed.commit_roll)
        if parsed.editing_line_id is not None:
            cur["editing_line_id"] = parsed.editing_line_id or None
        if parsed.editing_step is not None:
            cur["editing_step"] = parsed.editing_step or None
        if parsed.unprepare_cast_spell is not None:
            cur["unprepare_cast_spell"] = bool(parsed.unprepare_cast_spell)
        if parsed.gm_complication is not None:
            cur["gm_complication"] = clean_complication(parsed.gm_complication)
        return StageOutcome.ok_data(cur)

    def _complication_problem(self, wf: Workflow, ctx: StageCtx) -> str | None:
        """Косяк пишет только мастер: на 7–9 или когда к6 выше к8."""
        if not is_gm(ctx):
            return "Косяк вписывает только мастер"
        try:
            entry = self._context(wf).entry
        except Exception:
            return "Контекст хода повреждён"
        if not complication_reasons(entry):
            return "Косяк бывает только на результате 7–9 или когда к6 выше к8"
        return None

    def apply_patch(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> None:
        # Drop fields that belong on entry, not ChangeManifestState
        if data.get("lines") is not None:
            previous = read_manifest(wf).model_dump(mode="json").get("lines") or []
            data = {
                **data,
                "lines": stamp_line_rollers(
                    _reconcile_lines(
                        previous,
                        list(data["lines"]),
                        gm=is_gm(ctx),
                        user_id=str(ctx.actor_user_id),
                    ),
                    ctx.links,
                ),
            }
        manifest_data = {
            k: v for k, v in data.items()
            if k not in ("unprepare_cast_spell", "gm_complication", "commit_roll")
        }
        write_manifest(wf, ChangeManifestState.model_validate(manifest_data))
        if data.get("commit_roll"):
            self._apply_roll(wf, ctx, data["commit_roll"])
        if data.get("gm_complication") is not None:
            try:
                c = self._context(wf)
                c.entry.gm_complication = clean_complication(data["gm_complication"])
                wf.context = c.model_dump(mode="json")
            except Exception:
                pass
        if data.get("unprepare_cast_spell") is not None:
            try:
                c = self._context(wf)
                c.entry.unprepare_cast_spell = bool(data["unprepare_cast_spell"])
                wf.context = c.model_dump(mode="json")
            except Exception:
                pass

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        parsed = ctx.rb.parse_input(ManifestSubmitInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)
        data = {"action": parsed.action, "mode": parsed.mode}
        if parsed.gm_complication is not None:
            data["gm_complication"] = parsed.gm_complication
        if parsed.lines is not None:
            data["lines"] = list(parsed.lines)
        if parsed.unprepare_cast_spell is not None:
            data["unprepare_cast_spell"] = bool(parsed.unprepare_cast_spell)
        return StageOutcome.ok_data(data)

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = self._context(wf)
        except Exception as e:
            return err("context", str(e))

        validation = self.validate_submit(wf, ctx, data)
        if not validation.ok:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=validation.issues,
            )

        payload = validation.data
        gm = is_gm(ctx)
        action = str(payload.get("action") or "continue")
        stored_mode = read_manifest(wf).mode
        mode = str(payload.get("mode") or stored_mode or "edit")

        if not gm:
            return err("", "Завершает заявку мастер")

        if payload.get("gm_complication") is not None:
            problem = self._complication_problem(wf, ctx)
            if problem:
                return err("gm_complication", problem)
            c.entry.gm_complication = clean_complication(payload["gm_complication"])
            wf.context = c.model_dump(mode="json")

        if payload.get("unprepare_cast_spell") is not None:
            c.entry.unprepare_cast_spell = bool(payload["unprepare_cast_spell"])
            wf.context = c.model_dump(mode="json")

        if payload.get("lines") is not None:
            write_manifest(
                wf,
                ChangeManifestState.model_validate({
                    **read_manifest(wf).model_dump(mode="json"),
                    "lines": stamp_line_rollers(list(payload["lines"]), ctx.links),
                    "mode": payload.get("mode") or read_manifest(wf).mode,
                }),
            )

        prefill_manifest_from_entry(wf, c)
        sync_manifest_lines_to_entry(wf, c, ctx.scene, mode=read_manifest(wf).mode or mode)
        c = PerformMoveContext.model_validate(wf.context or {})
        assign_claim_rollers(c, ctx.links)
        wf.context = c.model_dump(mode="json")

        state = read_manifest(wf)
        if state.sent_to_gm:
            state.sent_to_gm = False
            write_manifest(wf, state)
        if payload.get("unprepare_cast_spell") is not None:
            c.entry.unprepare_cast_spell = bool(payload["unprepare_cast_spell"])
            wf.context = c.model_dump(mode="json")

        wf.stageData = {
            **(wf.stageData or {}),
            "damageQuickOptions": damage_quick_options(ctx.scene, self.full_codex),
            "manifestAction": action,
            "manifestMode": mode,
        }

        move_id = primary_move_id(c.entry)
        moves_map = moves_map_for_workflow(wf, self.full_codex, c=c)
        factories = collect_participating_factories(c.entry, moves_map, ctx.scene)
        wf.stageData["resourceFactories"] = factories
        wf.stageData["grantTemplates"] = factories

        blocked = _finish_block(read_manifest(wf).lines)
        if action == "apply" and blocked:
            return err("", blocked)
        if action == "apply" or mode == "review":
            wf.stageData["manifestNext"] = "apply"
        else:
            wf.stageData["manifestNext"] = "stay"

        sync_claims_to_manifest_lines(wf, c)

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        from ..stage_store import uniq

        ids = self._gm_actor_helper_visibility(wf, ctx, participants)
        ids.extend(str(user) for user in (participants.participants or []))
        for line in read_manifest(wf).lines:
            if line.kind != "damage" or line.status == "skipped":
                continue
            uid = str((line.payload or {}).get("roller_user_id") or "")
            if uid:
                ids.append(uid)
        return uniq(ids)

    def _roll_problem(self, wf: Workflow, ctx: StageCtx, spec: dict[str, Any]) -> str | None:
        line_id = str(spec.get("id") or "")
        seed = str(spec.get("roll_seed") or "")
        if not line_id or not seed:
            return "Нужен seed броска"
        line = next((item for item in read_manifest(wf).lines if item.id == line_id), None)
        if line is None or line.kind != "damage" or line.status != "needs_roll":
            return "Эту заявку сейчас нельзя бросить"
        try:
            c = self._context(wf)
        except Exception:
            return "Контекст хода повреждён"
        sync_manifest_lines_to_entry(wf, c, ctx.scene, mode=read_manifest(wf).mode or "edit")
        c = PerformMoveContext.model_validate(wf.context or {})
        assign_claim_rollers(c, ctx.links)
        claim = next((item for item in c.entry.damage_claims or [] if str(item.id) == line_id), None)
        if claim is None:
            return "Заявка не найдена"
        roller = str(claim.roller_user_id or "")
        uid = str(ctx.actor_user_id)
        if roller and uid != roller:
            return "Бросает игрок, связанный с заявкой"
        if not roller and not is_gm(ctx):
            return "Бросает игрок, связанный с заявкой"
        return None

    def _apply_roll(self, wf: Workflow, ctx: StageCtx, spec: dict[str, Any]) -> None:
        line_id = str(spec.get("id") or "")
        c = self._context(wf)
        sync_manifest_lines_to_entry(wf, c, ctx.scene, mode=read_manifest(wf).mode or "edit")
        c = PerformMoveContext.model_validate(wf.context or {})
        assign_claim_rollers(c, ctx.links)
        claim = next((item for item in c.entry.damage_claims or [] if str(item.id) == line_id), None)
        if claim is None:
            return
        roll_damage_claim(claim, ctx.scene, seed=str(spec.get("roll_seed") or ""))
        wf.context = c.model_dump(mode="json")
        state = read_manifest(wf)
        for line in state.lines:
            if line.id != line_id:
                continue
            line.status = "rolled"
            line.payload = {
                **line.payload,
                "rolled": True,
                "dice": list(claim.dice or []),
                "total_raw": claim.total_raw,
                "total_final": claim.total_final,
                "armor_applied": claim.armor_applied,
                "roll_seed": claim.roll_seed,
            }
        write_manifest(wf, state)

    @staticmethod
    def ensure_initialized(wf: Workflow, c: PerformMoveContext) -> None:
        from ..helpers import default_unprepare_cast_spell

        if c.entry.cast_spell_entry_id:
            c.entry.unprepare_cast_spell = default_unprepare_cast_spell(
                c.entry.roll.outcome if c.entry.roll else None
            )
            wf.context = c.model_dump(mode="json")
        prefill_manifest_from_entry(wf, c)
