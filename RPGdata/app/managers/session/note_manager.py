from __future__ import annotations

import json
import traceback
import uuid
from datetime import datetime, timezone
from uuid import UUID
from typing import Optional, Tuple, List

from app import models, scheme
from app.scheme.session.dispatch import SessionDispatch
from app.scheme.session.message_reply import SessionMessageReply
from app.scheme.session.notification.notes import NoteShownNotification
from app.logger import logger
from app.services.scenario_entities.common import with_db
from app.services.scenario_entities import notes as notes_service, counters as counters_service

from .user_manager import SessionUserManager

KIND_PLOT = "kind:plot"
KIND_DISPATCH = "kind:dispatch"
KIND_TASK = "kind:task"


def _sender_name(user: models.User) -> str:
    return user.full_name or user.email or str(user.id)


def _ensure_kind_tags(tags: list[str], note: scheme.Note, sender_role: str) -> list[str]:
    merged = list(dict.fromkeys([*(tags or []), *(note.tags or [])]))
    merged = [str(t) for t in merged if str(t).strip()]
    has_task = "task" in merged or KIND_TASK in merged
    if has_task:
        if KIND_TASK not in merged:
            merged.append(KIND_TASK)
    elif sender_role == "player":
        if KIND_DISPATCH not in merged:
            merged.append(KIND_DISPATCH)
    elif KIND_PLOT not in merged and KIND_DISPATCH not in merged:
        merged.append(KIND_PLOT)
    return merged


def _note_content_fingerprint(note: scheme.Note) -> str:
    payload = {
        "name": note.name,
        "text": note.text,
        "icon_url": str(note.icon_url) if note.icon_url else None,
        "img_url": str(note.img_url) if note.img_url else None,
        "tags": sorted(str(t) for t in (note.tags or [])),
        "allowed_character_shown_json": sorted(
            str(x) for x in (note.allowed_character_shown_json or [])
        ),
    }
    return json.dumps(payload, sort_keys=True, ensure_ascii=False)


def _resolve_recipient_users(
    inner: scheme.GameSessionInner,
    character_ids: list[UUID],
    *,
    include_master: bool = False,
) -> tuple[list[UUID], list[UUID]]:
    char_ids = list(character_ids or [])
    recipient_ids: list[UUID] = []
    seen: set[UUID] = set()

    if include_master and inner.master and inner.master.id not in seen:
        recipient_ids.append(inner.master.id)
        seen.add(inner.master.id)

    for p in inner.players or []:
        if not p.character_id or p.character_id not in char_ids:
            continue
        if p.user.id in seen:
            continue
        recipient_ids.append(p.user.id)
        seen.add(p.user.id)

    return recipient_ids, char_ids


def _find_note(inner: scheme.GameSessionInner, note_id: UUID) -> scheme.Note | None:
    return next((n for n in (inner.notes or []) if n.id == note_id), None)


def _note_owner_id(note: scheme.Note, inner: scheme.GameSessionInner) -> UUID:
    owner = getattr(note, "owner_user_id", None)
    if owner:
        return owner
    return inner.master.id


class SessionNoteManager(SessionUserManager):
    def __init__(self, session_id):
        super().__init__(str(session_id))

    async def _get_dispatches_raw(self) -> list:
        inner = await self.get_inner()
        return list(getattr(inner, "dispatches", None) or [])

    async def _set_dispatches_raw(self, dispatches: list) -> None:
        await self.set_field("dispatches", dispatches)

    async def _append_dispatch(self, dispatch: SessionDispatch) -> None:
        dispatches = await self._get_dispatches_raw()
        dispatches.append(dispatch.model_dump(mode="json"))
        await self._set_dispatches_raw(dispatches)

    async def _replace_dispatch(self, dispatch: SessionDispatch) -> bool:
        dispatches = await self._get_dispatches_raw()
        found = False
        out = []
        for raw in dispatches:
            d = SessionDispatch.model_validate(raw)
            if d.id == dispatch.id:
                out.append(dispatch.model_dump(mode="json"))
                found = True
            else:
                out.append(raw)
        if not found:
            return False
        await self._set_dispatches_raw(out)
        return True

    async def _get_replies_raw(self) -> list:
        inner = await self.get_inner()
        return list(getattr(inner, "message_replies", None) or [])

    async def _set_replies_raw(self, replies: list) -> None:
        await self.set_field("message_replies", replies)

    def _is_note_owner(self, user: models.User, note: scheme.Note, inner: scheme.GameSessionInner) -> bool:
        return user.id == _note_owner_id(note, inner)

    def _user_can_see_note(
        self,
        user_id: UUID,
        note_id: UUID,
        inner: scheme.GameSessionInner,
        *,
        is_master: bool,
    ) -> bool:
        if is_master:
            return True
        note = _find_note(inner, note_id)
        if note and _note_owner_id(note, inner) == user_id:
            return True
        uid = str(user_id)
        for raw in getattr(inner, "dispatches", None) or []:
            d = SessionDispatch.model_validate(raw)
            if str(d.note.id) != str(note_id):
                continue
            if d.revoked_at:
                continue
            if str(d.sender_id) == uid:
                return True
            recipients = [str(x) for x in (d.recipient_user_ids or [])]
            if not recipients or uid in recipients:
                return True
        return False

    def _notes_for_user(
        self,
        inner: scheme.GameSessionInner,
        user_id: UUID,
        *,
        is_master: bool,
    ) -> list:
        if is_master:
            return [n.model_dump(mode="json") if hasattr(n, "model_dump") else n for n in (inner.notes or [])]
        out = []
        for n in inner.notes or []:
            note = scheme.Note.model_validate(n) if not isinstance(n, scheme.Note) else n
            if _note_owner_id(note, inner) == user_id:
                out.append(note.model_dump(mode="json"))
        return out

    def _replies_for_user(
        self,
        inner: scheme.GameSessionInner,
        user_id: UUID,
        *,
        is_master: bool,
    ) -> list:
        out = []
        for raw in getattr(inner, "message_replies", None) or []:
            reply = SessionMessageReply.model_validate(raw)
            if reply.deleted_at:
                continue
            if self._user_can_see_note(user_id, reply.note_id, inner, is_master=is_master):
                out.append(reply.model_dump(mode="json"))
        return out

    def _active_player_user_ids(self, inner: scheme.GameSessionInner) -> set[str]:
        return {str(p.user.id) for p in (inner.players or []) if p.user and p.user.id}

    def _dispatch_sender_active(self, d: SessionDispatch, inner: scheme.GameSessionInner) -> bool:
        if d.sender_role != "player":
            return True
        return str(d.sender_id) in self._active_player_user_ids(inner)

    def _dispatches_for_user(
        self,
        inner: scheme.GameSessionInner,
        user_id: UUID,
        *,
        is_master: bool,
    ) -> list:
        out = []
        uid = str(user_id)
        for raw in getattr(inner, "dispatches", None) or []:
            d = SessionDispatch.model_validate(raw)
            if not self._dispatch_sender_active(d, inner):
                continue
            if d.revoked_at and not is_master:
                continue
            if is_master:
                out.append(d.model_dump(mode="json"))
                continue
            if str(d.sender_id) == uid:
                out.append(d.model_dump(mode="json"))
                continue
            recipients = [str(x) for x in (d.recipient_user_ids or [])]
            if not recipients or uid in recipients:
                out.append(d.model_dump(mode="json"))
        return out

    async def _emit_dispatch_notifications(self, dispatch: SessionDispatch) -> None:
        for uid in dispatch.recipient_user_ids or []:
            notif = NoteShownNotification(
                id=dispatch.id,
                dt=dispatch.sent_at,
                initiator_id=dispatch.sender_id,
                recipients=[uid],
                readed_by=[],
                note=dispatch.note,
            )
            await self.add_notification(notif)

    async def _reset_dispatch_notifications(self, dispatch: SessionDispatch) -> None:
        notifications = await self.get_field("notifications") or []
        did = str(dispatch.id)
        now = datetime.now(timezone.utc)
        out: list = []
        found = False
        for raw in notifications:
            try:
                notif = scheme.NotificationUnion.model_validate(raw)
            except Exception:
                out.append(raw)
                continue
            if str(getattr(notif, "id", "")) != did:
                out.append(raw if isinstance(raw, dict) else notif.model_dump(mode="json"))
                continue
            found = True
            if getattr(notif, "notif_type", None) == "note_shown":
                notif = notif.model_copy(
                    update={
                        "note": dispatch.note,
                        "readed_by": [],
                        "dt": now,
                    }
                )
            out.append(notif.model_dump(mode="json"))
        if found:
            await self.set_field("notifications", out)
        else:
            await self._emit_dispatch_notifications(dispatch)

    async def _mark_dispatch_unread(self, dispatch: SessionDispatch) -> SessionDispatch:
        dispatch.read_by = []
        dispatch.read_at_by = {}
        return dispatch

    async def _append_character_shown(self, note_id: UUID, character_ids: list[UUID]) -> None:
        """Track shown characters on dispatch snapshots (runtime only, not in DB)."""
        if not character_ids:
            return

        dispatches = await self._get_dispatches_raw()
        out: list = []
        changed = False
        for raw in dispatches:
            d = SessionDispatch.model_validate(raw)
            if str(d.note.id) != str(note_id):
                out.append(raw)
                continue
            shown = list(d.note.character_shown or [])
            for cid in character_ids:
                if cid not in shown:
                    shown.append(cid)
            d.note = d.note.model_copy(update={"character_shown": shown})
            out.append(d.model_dump(mode="json"))
            changed = True
        if changed:
            await self._set_dispatches_raw(out)

    async def _sync_dispatch_note_tags(self, note_id: UUID, tags: list[str]) -> None:
        dispatches = await self._get_dispatches_raw()
        out = []
        changed = False
        for raw in dispatches:
            d = SessionDispatch.model_validate(raw)
            if str(d.note.id) == str(note_id):
                d.note = d.note.model_copy(update={"tags": tags})
                d.tags = _ensure_kind_tags(list(d.tags or []), d.note, d.sender_role)
                out.append(d.model_dump(mode="json"))
                changed = True
            else:
                out.append(raw)
        if changed:
            await self._set_dispatches_raw(out)

    async def sync_dispatches_after_notes_change(
        self,
        editor_id: UUID | None = None,
    ) -> list[str]:
        """After note edit: refresh dispatch snapshots and mark recipients unread."""
        inner = await self.get_inner()
        notes_by_id = {n.id: n for n in (inner.notes or [])}
        dispatches = await self._get_dispatches_raw()
        out: list = []
        changed = False
        notif_changed = False
        now = datetime.now(timezone.utc)
        for raw in dispatches:
            d = SessionDispatch.model_validate(raw)
            fresh = notes_by_id.get(d.note.id)
            if not fresh or d.revoked_at:
                out.append(raw)
                continue
            if _note_content_fingerprint(d.note) == _note_content_fingerprint(fresh):
                out.append(raw)
                continue
            d.note = fresh.model_copy(update={"character_shown": d.note.character_shown})
            d.tags = _ensure_kind_tags(list(d.tags or []), d.note, d.sender_role)
            d = await self._mark_dispatch_unread(d)
            if editor_id:
                d.edited_at = now
                d.edited_by = editor_id
            await self._reset_dispatch_notifications(d)
            out.append(d.model_dump(mode="json"))
            changed = True
            notif_changed = True
        if changed:
            await self._set_dispatches_raw(out)
        fields: list[str] = []
        if changed:
            fields.append("dispatches")
        if notif_changed:
            fields.append("notifications")
        return fields

    async def _update_db_note(self, note_id: UUID, note_in: scheme.NoteCreate) -> bool:
        updated = await with_db(
            lambda db: notes_service.update_note(db, note_id=note_id, note_in=note_in)
        )
        return updated is not None

    async def edit_note(
        self,
        user: models.User,
        note_id: UUID,
        note_in: scheme.NoteCreate,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        note = _find_note(inner, note_id)
        if not note or not self._is_note_owner(user, note, inner):
            return False, []

        ok = await self._update_db_note(note_id, note_in)
        if not ok:
            return False, []
        await self.invalidate_entity_cache()
        extra = await self.sync_dispatches_after_notes_change(editor_id=user.id)
        fields = ["notes", *extra]
        return True, list(dict.fromkeys(fields))

    async def edit_dispatch(
        self,
        user: models.User,
        dispatch_id: UUID,
        note_in: scheme.NoteCreate,
    ) -> Tuple[bool, list[str]]:
        dispatches = await self._get_dispatches_raw()
        target: SessionDispatch | None = None
        for raw in dispatches:
            d = SessionDispatch.model_validate(raw)
            if d.id == dispatch_id:
                target = d
                break
        if not target or target.revoked_at:
            return False, []
        return await self.edit_note(user, target.note.id, note_in)

    async def _notify_on_reply(self, note_id: UUID, author_id: UUID) -> list[str]:
        """Mark related dispatches unread for everyone except the reply author."""
        dispatches = await self._get_dispatches_raw()
        out: list = []
        changed = False
        notif_changed = False
        now = datetime.now(timezone.utc)
        for raw in dispatches:
            d = SessionDispatch.model_validate(raw)
            if str(d.note.id) != str(note_id) or d.revoked_at:
                out.append(raw)
                continue
            prev_read = list(d.read_by or [])
            d.read_by = [uid for uid in prev_read if uid == author_id]
            d.edited_at = now
            d.edited_by = author_id
            await self._reset_dispatch_notifications(d)
            out.append(d.model_dump(mode="json"))
            changed = True
            notif_changed = True
        if changed:
            await self._set_dispatches_raw(out)
        fields: list[str] = []
        if changed:
            fields.append("dispatches")
        if notif_changed:
            fields.append("notifications")
        return fields

    async def add_message_reply(
        self,
        user: models.User,
        note_id: UUID,
        text: str,
    ) -> Tuple[bool, list[str]]:
        content = (text or "").strip()
        if not content:
            return False, []

        inner = await self.get_inner()
        is_master = await self.is_master(user)
        if not self._user_can_see_note(user.id, note_id, inner, is_master=is_master):
            return False, []

        sender_role = "master" if is_master else "player"
        reply = SessionMessageReply(
            note_id=note_id,
            author_id=user.id,
            author_role=sender_role,
            author_name=_sender_name(user),
            text=content,
        )
        replies = await self._get_replies_raw()
        replies.append(reply.model_dump(mode="json"))
        await self._set_replies_raw(replies)
        extra = await self._notify_on_reply(note_id, user.id)
        return True, list(dict.fromkeys(["message_replies", *extra]))

    async def edit_message_reply(
        self,
        user: models.User,
        reply_id: UUID,
        text: str,
    ) -> Tuple[bool, list[str]]:
        content = (text or "").strip()
        if not content:
            return False, []

        replies = await self._get_replies_raw()
        out = []
        found = False
        for raw in replies:
            reply = SessionMessageReply.model_validate(raw)
            if reply.id != reply_id:
                out.append(raw)
                continue
            if reply.author_id != user.id:
                return False, []
            reply = reply.model_copy(update={"text": content, "edited_at": datetime.now(timezone.utc)})
            out.append(reply.model_dump(mode="json"))
            found = True
        if not found:
            return False, []
        await self._set_replies_raw(out)
        return True, ["message_replies"]

    async def delete_message_reply(
        self,
        user: models.User,
        reply_id: UUID,
    ) -> Tuple[bool, list[str]]:
        replies = await self._get_replies_raw()
        out = []
        found = False
        for raw in replies:
            reply = SessionMessageReply.model_validate(raw)
            if reply.id != reply_id:
                out.append(raw)
                continue
            if reply.author_id != user.id:
                return False, []
            reply = reply.model_copy(update={"deleted_at": datetime.now(timezone.utc)})
            out.append(reply.model_dump(mode="json"))
            found = True
        if not found:
            return False, []
        await self._set_replies_raw(out)
        return True, ["message_replies"]

    async def create_note(self, user: models.User, note: scheme.NoteCreate) -> Tuple[bool, list[str]]:
        scenario_id = await self.get_scenario_id()
        is_master = await self.is_master(user)
        owner_role = "master" if is_master else "player"
        await with_db(
            lambda db: notes_service.create_note(
                db,
                scenario_id=scenario_id,
                note_in=note,
                owner_user_id=user.id,
                owner_role=owner_role,
            )
        )
        await self.invalidate_entity_cache()
        return True, ["notes"]

    async def player_create_note(
        self,
        user: models.User,
        note_in: scheme.NoteCreate,
    ) -> Tuple[bool, list[str]]:
        if await self.is_master(user):
            return False, []
        tags = [str(t) for t in (note_in.tags or []) if str(t).strip()]
        if not tags:
            return False, []
        merged = list(dict.fromkeys([*tags, KIND_DISPATCH]))
        payload = note_in.model_copy(update={"tags": merged})
        return await self.create_note(user, payload)

    async def delete_note(self, user: models.User, note_id: UUID) -> Tuple[bool, list[str]]:
        ok = await with_db(lambda db: notes_service.delete_note(db, note_id=note_id))
        if not ok:
            return False, []
        await self.invalidate_entity_cache()
        return True, ["notes"]

    async def show_note(
        self,
        user: models.User,
        note_id: UUID,
        characters_ids: Optional[list[UUID]] = None,
        include_master: bool = False,
    ) -> Tuple[bool, list[str]]:
        return await self.publish_note(
            user,
            note_id=note_id,
            character_ids=characters_ids or [],
            include_master=include_master,
        )

    async def publish_note(
        self,
        user: models.User,
        *,
        note_id: UUID,
        character_ids: Optional[list[UUID]] = None,
        include_master: bool = False,
        tags: Optional[list[str]] = None,
    ) -> Tuple[bool, list[str]]:
        try:
            inner = await self.get_inner()
            note = _find_note(inner, note_id)
            if not note or not self._is_note_owner(user, note, inner):
                return False, []

            is_master = await self.is_master(user)
            sender_role = "master" if is_master else "player"
            char_ids = list(character_ids or [])
            recipient_ids, char_ids = _resolve_recipient_users(
                inner, char_ids, include_master=include_master
            )
            if not recipient_ids:
                return False, []

            kind_tags = _ensure_kind_tags(list(tags or note.tags or []), note, sender_role)
            shown = list(note.character_shown or [])
            for cid in char_ids:
                if cid not in shown:
                    shown.append(cid)
            note_for_dispatch = note.model_copy(update={"character_shown": shown})
            dispatch = SessionDispatch(
                sender_id=user.id,
                sender_role=sender_role,
                sender_name=_sender_name(user),
                note=note_for_dispatch,
                recipient_user_ids=recipient_ids,
                recipient_character_ids=char_ids,
                tags=kind_tags,
            )
            await self._append_dispatch(dispatch)
            await self._append_character_shown(note_id, char_ids)
            await self._emit_dispatch_notifications(dispatch)
            return True, ["dispatches", "notifications"]
        except Exception as e:
            logger.error("EXCEPTION in publish_note: %s\n%s", e, traceback.format_exc())
            return False, []

    async def dispatch_note(
        self,
        user: models.User,
        *,
        note_id: UUID,
        character_ids: Optional[list[UUID]] = None,
        tags: Optional[list[str]] = None,
    ) -> Tuple[bool, list[str]]:
        return await self.publish_note(
            user,
            note_id=note_id,
            character_ids=character_ids,
            include_master=False,
            tags=tags,
        )

    async def player_dispatch_note(
        self,
        user: models.User,
        note_in: scheme.NoteCreate,
        character_ids: Optional[list[UUID]] = None,
        include_master: bool = True,
    ) -> Tuple[bool, list[str]]:
        tags = [str(t) for t in (note_in.tags or []) if str(t).strip()]
        if not tags:
            return False, []

        try:
            scenario_id = await self.get_scenario_id()
            merged_tags = list(dict.fromkeys([*tags, KIND_DISPATCH]))
            note_payload = note_in.model_copy(update={"tags": merged_tags})
            db_note = await with_db(
                lambda db: notes_service.create_note(
                    db,
                    scenario_id=scenario_id,
                    note_in=note_payload,
                    owner_user_id=user.id,
                    owner_role="player",
                )
            )
            await self.invalidate_entity_cache()
            note = scheme.Note.model_validate(db_note)

            char_ids = list(character_ids or [])
            if note_in.allowed_character_shown_json:
                for cid in note_in.allowed_character_shown_json:
                    if cid not in char_ids:
                        char_ids.append(cid)

            ok, pub_fields = await self.publish_note(
                user,
                note_id=note.id,
                character_ids=char_ids,
                include_master=include_master,
            )
            if not ok:
                return False, []
            return True, list(dict.fromkeys(["notes", *pub_fields]))
        except Exception as e:
            logger.error("EXCEPTION in player_dispatch_note: %s\n%s", e, traceback.format_exc())
            return False, []

    async def mark_dispatch_opened(
        self,
        user: models.User,
        dispatch_id: UUID,
    ) -> Tuple[bool, list[str]]:
        dispatches = await self._get_dispatches_raw()
        target: SessionDispatch | None = None
        for raw in dispatches:
            d = SessionDispatch.model_validate(raw)
            if d.id == dispatch_id:
                target = d
                break
        if not target or target.revoked_at:
            return False, []

        uid = user.id
        if uid not in (target.read_by or []):
            target.read_by = list(target.read_by or []) + [uid]
            target.read_at_by = dict(target.read_at_by or {})
            target.read_at_by[str(uid)] = datetime.now(timezone.utc)

        await self._replace_dispatch(target)
        await self.read_notifications(user, [dispatch_id])

        fields = ["dispatches", "notifications"]
        if target.recipient_character_ids and not await self.is_master(user):
            char_id = None
            inner = await self.get_inner()
            for p in inner.players or []:
                if p.user.id == uid and p.character_id:
                    char_id = p.character_id
                    break
            if char_id and char_id in target.recipient_character_ids:
                await self._append_character_shown(target.note.id, [char_id])
        return True, fields

    async def revoke_dispatch(
        self,
        user: models.User,
        dispatch_id: UUID,
    ) -> Tuple[bool, list[str]]:
        dispatches = await self._get_dispatches_raw()
        target: SessionDispatch | None = None
        for raw in dispatches:
            d = SessionDispatch.model_validate(raw)
            if d.id == dispatch_id:
                target = d
                break
        if not target or target.revoked_at:
            return False, []
        if str(target.sender_id) != str(user.id):
            return False, []

        target.revoked_at = datetime.now(timezone.utc)
        await self._replace_dispatch(target)
        return True, ["dispatches"]

    async def change_note_status(
        self,
        user: models.User,
        note_id: UUID,
        status: Optional[str],
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        note = next((n for n in (inner.notes or []) if n.id == note_id), None)
        if not note:
            return False, []

        tags = [str(t) for t in (note.tags or [])]
        if status == "pending":
            if "pending" not in tags:
                tags.append("pending")
            if "completed" in tags:
                tags.remove("completed")
        elif status == "completed":
            if "completed" not in tags:
                tags.append("completed")
            if "pending" in tags:
                tags.remove("pending")
        else:
            tags = [t for t in tags if t not in ("pending", "completed")]

        async def _update(db):
            from sqlalchemy import select

            obj = (await db.execute(select(models.Note).where(models.Note.id == note_id))).scalars().first()
            if not obj:
                return False
            obj.tags = tags
            await db.commit()
            return True

        ok = await with_db(_update)
        if not ok:
            return False, []
        await self.invalidate_entity_cache()
        await self._sync_dispatch_note_tags(note_id, tags)
        return True, ["notes", "dispatches"]

    async def create_counter(self, user: models.User, counter: scheme.CounterCreate) -> Tuple[bool, list[str]]:
        scenario_id = await self.get_scenario_id()
        await with_db(
            lambda db: counters_service.create_counter(db, scenario_id=scenario_id, counter_in=counter)
        )
        await self.invalidate_entity_cache()
        return True, ["counters"]

    async def delete_counter(self, user: models.User, counter_id: UUID) -> Tuple[bool, list[str]]:
        scenario_id = await self.get_scenario_id()
        ok = await with_db(
            lambda db: counters_service.delete_counter(db, counter_id=counter_id, scenario_id=scenario_id)
        )
        if not ok:
            return False, []
        await self.invalidate_entity_cache()
        return True, ["counters"]

    async def change_counter_value(self, user: models.User, counter_id: UUID, value: int) -> Tuple[bool, list[str]]:
        scenario_id = await self.get_scenario_id()
        updated = await with_db(
            lambda db: counters_service.update_counter_value(
                db, counter_id=counter_id, value=value, scenario_id=scenario_id
            )
        )
        if not updated:
            return False, []
        await self.invalidate_entity_cache()
        return True, ["counters"]

    async def set_note_check(self, user: models.User, note_id: UUID, is_checked: bool) -> Tuple[bool, list[str]]:
        ok = await with_db(
            lambda db: notes_service.update_note_checked(db, note_id=note_id, is_checked=is_checked)
        )
        if not ok:
            return False, []
        await self.invalidate_entity_cache()
        return True, ["notes"]
