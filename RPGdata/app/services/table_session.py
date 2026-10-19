"""Стол Переговорки: ссылка, статус, файлы, реплики и игровое время."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models

PEREGOVORKA_HOSTS = {"peregovorka.mos.ru", "www.peregovorka.mos.ru", "prodperegovorka.mos.ru"}
LIVE_STATUSES = ("joining", "live", "lobby")
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "/app/media"))


def bridge_audio_path(url: str) -> str | None:
    """Путь трека внутри общего каталога media, без адреса браузера."""
    marker = "/media/"
    index = (url or "").find(marker)
    if index < 0:
        return None
    relative = url[index + len(marker):].split("?", 1)[0].split("#", 1)[0]
    parts = [part for part in Path(relative).parts if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        return None
    return "/".join(parts)


def parse_room_url(url: str) -> tuple[str, str]:
    """Домен и код комнаты из ссылки Переговорки."""
    parsed = urlparse((url or "").strip())
    host = (parsed.hostname or "").lower()
    if host not in PEREGOVORKA_HOSTS:
        raise ValueError("Пока принимается только ссылка Переговорки")
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) >= 2 and parts[0] == "room":
        code = parts[1]
    elif parts:
        code = parts[-1]
    else:
        raise ValueError("В ссылке нет кода комнаты")
    return host, code


def game_time_at(marks: list[tuple[datetime, str]], real_at: datetime) -> str | None:
    """Последняя метка, чьё реальное время не позже начала реплики."""
    moment = _aware(real_at)
    chosen: str | None = None
    for mark_at, game_time in marks:
        if _aware(mark_at) <= moment:
            chosen = game_time
        else:
            break
    return chosen


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def record_game_time_mark(db: AsyncSession, session_id: UUID, game_time: str, real_at: datetime | None = None) -> None:
    db.add(models.GameTimeMark(
        session_id=session_id,
        real_at=_aware(real_at or datetime.now(timezone.utc)),
        game_time=game_time,
    ))


async def marks_for_session(db: AsyncSession, session_id: UUID) -> list[tuple[datetime, str]]:
    rows = (await db.execute(
        select(models.GameTimeMark)
        .where(models.GameTimeMark.session_id == session_id)
        .order_by(models.GameTimeMark.real_at.asc())
    )).scalars().all()
    return [(_aware(row.real_at), row.game_time) for row in rows]


async def tables_of(db: AsyncSession, game_session_id: UUID) -> list[models.TableSession]:
    return list((await db.execute(
        select(models.TableSession)
        .where(
            models.TableSession.game_session_id == game_session_id,
            models.TableSession.preview.is_(False),
            models.TableSession.status != "discarded",
        )
        .order_by(models.TableSession.created_at.asc())
    )).scalars().all())


async def approaches_for(db: AsyncSession, scenario_id: UUID) -> list[models.GameSession]:
    return list((await db.execute(
        select(models.GameSession)
        .where(
            (models.GameSession.scenario_id == scenario_id)
            | (models.GameSession.launched_scenario_id == scenario_id)
        )
        .order_by(models.GameSession.created_at.asc())
    )).scalars().all())


async def latest_table(db: AsyncSession, game_session_id: UUID) -> models.TableSession | None:
    return (await db.execute(
        select(models.TableSession)
        .where(
            models.TableSession.game_session_id == game_session_id,
            models.TableSession.preview.is_(False),
            models.TableSession.status != "discarded",
        )
        .order_by(models.TableSession.created_at.desc())
    )).scalars().first()


async def latest_preview(db: AsyncSession, lobby_id: UUID) -> models.TableSession | None:
    return (await db.execute(
        select(models.TableSession)
        .where(
            models.TableSession.lobby_id == lobby_id,
            models.TableSession.preview.is_(True),
        )
        .order_by(models.TableSession.created_at.desc())
    )).scalars().first()


async def open_preview(
    db: AsyncSession,
    lobby_id: UUID,
    room_url: str,
    password: str | None,
    music_enabled: bool,
    auto_connect: bool = False,
) -> models.TableSession:
    domain, code = parse_room_url(room_url)
    current = await latest_preview(db, lobby_id)
    if current is not None and current.status in (*LIVE_STATUSES, "idle") and current.left_at is None:
        current.room_url = room_url.strip()
        current.domain = domain
        current.room_code = code
        current.password = password or None
        current.music_enabled = music_enabled
        current.auto_connect = auto_connect
        current.status = "joining"
        current.status_detail = None
        current.left_at = None
        return current
    row = models.TableSession(
        game_session_id=None,
        lobby_id=lobby_id,
        preview=True,
        room_url=room_url.strip(),
        domain=domain,
        room_code=code,
        password=password or None,
        status="joining",
        music_enabled=music_enabled,
        auto_connect=auto_connect,
        test_requested=False,
    )
    db.add(row)
    await db.flush()
    return row


async def erase_recordings(db: AsyncSession, table_id: UUID) -> None:
    utterances = (await db.execute(
        select(models.TableUtterance).where(models.TableUtterance.table_session_id == table_id)
    )).scalars().all()
    for row in utterances:
        await db.delete(row)
    segments = (await db.execute(
        select(models.TableSegment).where(models.TableSegment.table_session_id == table_id)
    )).scalars().all()
    for row in segments:
        relative = row.file_path or ""
        if relative and ".." not in Path(relative).parts:
            try:
                (MEDIA_ROOT / relative).unlink()
            except OSError:
                pass
        await db.delete(row)
    spans = (await db.execute(
        select(models.TableMusicSpan).where(models.TableMusicSpan.table_session_id == table_id)
    )).scalars().all()
    for row in spans:
        await db.delete(row)
    recaps = (await db.execute(
        select(models.TableRecap).where(models.TableRecap.table_session_id == table_id)
    )).scalars().all()
    for row in recaps:
        await db.delete(row)
    people = await participants_of(db, table_id)
    for row in people:
        row.live_bytes = 0
        row.live_seconds = 0


async def settle_tables(db: AsyncSession, game_session_id: UUID, *, discard: bool) -> None:
    """Завершение подхода отпускает бота. Прерывание ещё и стирает уже записанное."""
    rows = (await db.execute(
        select(models.TableSession).where(
            models.TableSession.game_session_id == game_session_id,
            models.TableSession.preview.is_(False),
        )
    )).scalars().all()
    for row in rows:
        if discard:
            await erase_recordings(db, row.id)
            row.status = "discarded"
            row.left_at = datetime.now(timezone.utc)
            continue
        if row.status in LIVE_STATUSES or row.status == "stopping":
            row.status = "stopping"


async def discard_lobby_preview(db: AsyncSession, lobby_id: UUID) -> None:
    rows = (await db.execute(
        select(models.TableSession).where(
            models.TableSession.lobby_id == lobby_id,
            models.TableSession.preview.is_(True),
        )
    )).scalars().all()
    for row in rows:
        await db.delete(row)


async def carry_lobby_table(db: AsyncSession, lobby, game_session_id: UUID) -> None:
    """Настройки комнаты из лобби становятся настоящим столом. Проверочная запись стирается."""
    lobby_id = getattr(lobby, "id", None)
    if lobby_id is not None:
        await discard_lobby_preview(db, lobby_id)
    room_url = (getattr(lobby, "jitsi_room_url", "") or "").strip()
    if not room_url:
        return
    try:
        table = await open_table(
            db,
            game_session_id,
            room_url,
            getattr(lobby, "jitsi_password", "") or None,
        )
    except ValueError:
        return
    auto = bool(getattr(lobby, "jitsi_auto", False))
    table.music_enabled = bool(getattr(lobby, "jitsi_music", False))
    table.auto_connect = auto
    table.preview = False
    if not auto:
        table.status = "idle"
        table.status_detail = None
    await route_session_music(game_session_id, auto and table.music_enabled)


async def open_table(
    db: AsyncSession,
    game_session_id: UUID,
    room_url: str,
    password: str | None,
    auto_connect: bool | None = None,
) -> models.TableSession:
    domain, code = parse_room_url(room_url)
    current = await latest_table(db, game_session_id)
    reusable = current is not None and current.left_at is None and current.status in (*LIVE_STATUSES, "idle")
    if reusable:
        current.room_url = room_url.strip()
        current.domain = domain
        current.room_code = code
        current.password = password or None
        if auto_connect is not None:
            current.auto_connect = auto_connect
        current.status = "joining"
        current.status_detail = None
        current.left_at = None
        return current
    row = models.TableSession(
        game_session_id=game_session_id,
        room_url=room_url.strip(),
        domain=domain,
        room_code=code,
        password=password or None,
        status="joining",
        music_enabled=False,
        auto_connect=bool(auto_connect),
        test_requested=False,
    )
    db.add(row)
    await db.flush()
    return row


async def route_session_music(session_id: UUID, to_jitsi: bool) -> None:
    """Куда слышна очередь: в браузере или только в комнате Переговорки."""
    try:
        from app.managers import master_connection_manager
        from app.managers.session_manager import session_manager

        manager = await session_manager.ensure_manager(str(session_id))
        if not await manager.session_exists():
            return
        inner = await manager.get_inner()
        target = "jitsi" if to_jitsi else "web"
        if inner.audio_player.via == target:
            return
        inner.audio_player.via = target
        await manager.set_inner(inner)
        await manager.push_entity_updates(master_connection_manager["session"], ["audio_queue"])
    except Exception:
        return


async def participants_of(db: AsyncSession, table_id: UUID) -> list[models.TableParticipant]:
    return list((await db.execute(
        select(models.TableParticipant).where(models.TableParticipant.table_session_id == table_id)
    )).scalars().all())


async def utterances_of(db: AsyncSession, table_id: UUID) -> list[models.TableUtterance]:
    return list((await db.execute(
        select(models.TableUtterance)
        .where(models.TableUtterance.table_session_id == table_id)
        .order_by(models.TableUtterance.real_started_at.asc())
    )).scalars().all())


def looks_like_endpoint(name: str) -> bool:
    text = (name or "").strip()
    if not text or text.lower().startswith("ssrc-"):
        return True
    return len(text) >= 6 and all(char in "0123456789abcdef" for char in text.lower())


def _people_named(game_session_id: UUID, display_name: str):
    name = (display_name or "").strip()
    return (
        select(models.TableParticipant)
        .join(models.TableSession, models.TableParticipant.table_session_id == models.TableSession.id)
        .where(
            models.TableSession.game_session_id == game_session_id,
            models.TableSession.preview.is_(False),
            models.TableSession.status != "discarded",
            func.lower(models.TableParticipant.display_name) == name.lower(),
        )
    )


async def spread_binding(
    db: AsyncSession,
    game_session_id: UUID | None,
    display_name: str,
    kind: str,
    character_id,
    observer_code: str | None,
) -> None:
    """Одно имя из Jitsi сопоставлено одинаково во всех запусках подхода."""
    name = (display_name or "").strip()
    if game_session_id is None or not name or looks_like_endpoint(name):
        return
    rows = (await db.execute(_people_named(game_session_id, name))).scalars().all()
    for row in rows:
        row.bind_kind = kind
        row.character_id = character_id if kind == "character" else None
        row.observer_code = observer_code if kind == "observer" else None


async def _inherit_binding(db: AsyncSession, table: models.TableSession, row: models.TableParticipant) -> None:
    if row.bind_kind or table.game_session_id is None or looks_like_endpoint(row.display_name or ""):
        return
    donor = (await db.execute(
        _people_named(table.game_session_id, row.display_name or "")
        .where(
            models.TableParticipant.id != row.id,
            models.TableParticipant.bind_kind != "",
        )
        .limit(1)
    )).scalars().first()
    if donor is None:
        return
    row.bind_kind = donor.bind_kind
    row.character_id = donor.character_id
    row.observer_code = donor.observer_code


async def upsert_participant(
    db: AsyncSession,
    table_id: UUID,
    jitsi_id: str,
    display_name: str,
) -> models.TableParticipant:
    row = (await db.execute(
        select(models.TableParticipant).where(
            models.TableParticipant.table_session_id == table_id,
            models.TableParticipant.jitsi_id == jitsi_id,
        )
    )).scalars().first()
    created = row is None
    if row is None:
        row = models.TableParticipant(
            table_session_id=table_id,
            jitsi_id=jitsi_id,
            display_name=display_name or jitsi_id,
        )
        db.add(row)
        await db.flush()
    previous = row.display_name or ""
    incoming = (display_name or "").strip()
    if incoming and not (looks_like_endpoint(incoming) and previous and not looks_like_endpoint(previous)):
        row.display_name = incoming
    table = await db.get(models.TableSession, table_id)
    if table is not None:
        renamed = (row.display_name or "") != previous
        if row.bind_kind and renamed and not looks_like_endpoint(row.display_name or ""):
            await spread_binding(
                db,
                table.game_session_id,
                row.display_name,
                row.bind_kind,
                row.character_id,
                row.observer_code,
            )
        elif not row.bind_kind and (created or renamed):
            await _inherit_binding(db, table, row)
    return row


def tally_recordings(items: list[tuple[str, str, int, float]]) -> dict:
    """Сводка (id участника, имя, байты файла, секунды дорожки)."""
    buckets: dict[str, dict] = {}
    total = 0
    for participant_id, name, nbytes, seconds in items:
        bucket = buckets.setdefault(participant_id, {
            "participant_id": participant_id,
            "display_name": name or "участник",
            "bytes": 0,
            "seconds": 0.0,
        })
        if name:
            bucket["display_name"] = name
        bucket["bytes"] += max(int(nbytes), 0)
        bucket["seconds"] += max(float(seconds), 0.0)
        total += max(int(nbytes), 0)
    return {
        "bytes": total,
        "participants": list(buckets.values()),
    }


def is_bridge_occupant(row) -> bool:
    name = (row.display_name or "").strip().lower()
    jid = (row.jitsi_id or "").lower()
    return name in {"focus", "стол", "stol"} or jid.endswith("/focus") or jid.endswith("/стол") or jid.endswith("/stol")


def _file_size(relative: str) -> int:
    try:
        return (MEDIA_ROOT / relative).stat().st_size
    except OSError:
        return 0


async def recording_stats(db: AsyncSession, table_id: UUID, participants: list) -> dict:
    rows = (await db.execute(
        select(models.TableSegment).where(models.TableSegment.table_session_id == table_id)
    )).scalars().all()
    names = {row.id: row.display_name or row.jitsi_id for row in participants}
    items = [
        (row.id, names.get(row.id, "участник"), int(row.live_bytes or 0), float(row.live_seconds or 0))
        for row in participants
        if not is_bridge_occupant(row)
    ]
    for segment in rows:
        started = segment.real_started_at
        ended = segment.real_ended_at
        seconds = 0.0
        if started is not None and ended is not None:
            seconds = max((ended - started).total_seconds(), 0.0)
        items.append((
            segment.participant_id,
            names.get(segment.participant_id, "участник"),
            _file_size(segment.file_path or ""),
            seconds,
        ))
    return tally_recordings(items)


def segment_dir() -> Path:
    path = MEDIA_ROOT / "table" / "segments"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def audio_snapshot(session_id: UUID) -> dict | None:
    try:
        from app.managers.session_manager import session_manager

        manager = await session_manager.ensure_manager(str(session_id))
        runtime = await manager.get_runtime()
    except Exception:
        return None
    player = getattr(runtime, "audio_player", None)
    queue = getattr(runtime, "audio_queue", None) or []
    if player is None or player.current_entry_id is None:
        return None
    entry = next((item for item in queue if item.id == player.current_entry_id), None)
    relative = bridge_audio_path(entry.track_url) if entry is not None else None
    if entry is None or not relative:
        return None
    position_at = getattr(player, "position_at", None)
    return {
        "path": relative,
        "volume": player.volume if player.volume is not None else entry.volume,
        "loop": bool(entry.loop),
        "playing": bool(player.playing),
        "position_sec": float(getattr(player, "position_sec", 0) or 0),
        "position_at": position_at.isoformat() if position_at is not None else "",
    }
