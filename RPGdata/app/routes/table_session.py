"""Стол мастера: ссылка Переговорки, статус, стенограмма, черновик."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import require_master
from app.infrastructure.database import get_async_session as get_db
from app.infrastructure.settings import settings
from app.services import table_session as svc
from app.services.table_recap import build_recap

router = APIRouter(tags=["table"])
internal = APIRouter(prefix="/internal/tables", tags=["table-internal"])


class TableStart(BaseModel):
    room_url: str
    password: str | None = None


class MusicIn(BaseModel):
    enabled: bool


class TestReportIn(BaseModel):
    text: str


class ParticipantPatch(BaseModel):
    kind: Literal["", "character", "master", "observer"] = ""
    character_id: UUID | None = None
    observer_code: str | None = None


class StatusIn(BaseModel):
    status: str
    detail: str | None = None


class ParticipantIn(BaseModel):
    jitsi_id: str
    display_name: str = ""


class ProgressIn(BaseModel):
    jitsi_id: str
    display_name: str = ""
    bytes: int = 0
    seconds: float = 0


class MixIn(BaseModel):
    speakers: list[ProgressIn] = []
    drop: list[str] = []

    @field_validator("speakers", "drop", mode="before")
    @classmethod
    def empty_when_missing(cls, value):
        return [] if value is None else value


class MusicSpanIn(BaseModel):
    path: str
    started_at: datetime
    ended_at: datetime
    position_start: float = 0
    position_end: float = 0


class LobbyTableStart(BaseModel):
    room_url: str
    password: str | None = None
    enter: bool = True


class AutoIn(BaseModel):
    enabled: bool
    room_url: str = ""
    password: str | None = None


def _status_label(status: str) -> str:
    return {
        "joining": "подключается",
        "live": "в комнате",
        "lobby": "ждёт в лобби",
        "stopping": "выходит",
        "idle": "не подключён",
        "transcribing": "распознавание",
        "ready": "готово",
        "error": "ошибка",
    }.get(status, status)


async def _owned_session(
    session_id: UUID,
    user: models.User,
    db: AsyncSession,
) -> models.GameSession:
    row = await db.get(models.GameSession, session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    if row.master_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Только мастер этой сессии")
    return row


def _require_bridge(token: str | None) -> None:
    expected = settings.table_bridge_token
    if not expected or token != expected:
        raise HTTPException(status_code=401, detail="Неверный ключ стола")


async def _table_or_404(db: AsyncSession, table_id: UUID) -> models.TableSession:
    row = await db.get(models.TableSession, table_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Стол не найден")
    return row


def _bind_label(row, names: dict) -> str:
    kind = getattr(row, "bind_kind", "") or ""
    if kind == "master":
        return "Мастер"
    if kind == "observer" and row.observer_code:
        return f"Наблюдатель {row.observer_code}"
    if row.character_id and names.get(row.character_id):
        return names[row.character_id]
    return ""


def _public(table: models.TableSession, participants, utterances, recap, stats=None, names=None, music=None) -> dict:
    labels = names or {}
    return {
        "id": table.id,
        "created_at": table.created_at,
        "room_url": table.room_url,
        "domain": table.domain,
        "room_code": table.room_code,
        "has_password": bool(table.password),
        "status": table.status,
        "status_label": _status_label(table.status),
        "status_detail": table.status_detail,
        "music_enabled": bool(table.music_enabled),
        "auto_connect": bool(table.auto_connect),
        "test_report": table.test_report,
        "stats": stats or {"bytes": 0, "participants": []},
        "joined_at": table.joined_at,
        "left_at": table.left_at,
        "participants": [
            {
                "id": row.id,
                "jitsi_id": row.jitsi_id,
                "display_name": row.display_name,
                "character_id": row.character_id,
                "bind_kind": getattr(row, "bind_kind", "") or "",
                "observer_code": row.observer_code,
                "bind_label": _bind_label(row, labels),
            }
            for row in participants
        ],
        "utterances": [
            {
                "id": row.id,
                "participant_id": row.participant_id,
                "text": row.text,
                "confidence": row.confidence,
                "real_started_at": row.real_started_at,
                "real_ended_at": row.real_ended_at,
                "game_time": row.game_time,
                "provider": row.provider,
            }
            for row in utterances
        ],
        "music": [
            {
                "path": row.path,
                "started_at": row.started_at,
                "ended_at": row.ended_at,
                "position_start": row.position_start,
                "position_end": row.position_end,
            }
            for row in (music or [])
        ],
        "recap": None if recap is None else {
            "id": recap.id,
            "text": recap.text,
            "images": recap.images or [],
            "created_at": recap.created_at,
        },
    }


async def _character_names(db: AsyncSession, participants) -> dict:
    ids = [row.character_id for row in participants if row.character_id]
    if not ids:
        return {}
    rows = (await db.execute(
        select(models.PlayerCharacter).where(models.PlayerCharacter.id.in_(ids))
    )).scalars().all()
    return {row.id: row.name for row in rows}


async def _run_view(db: AsyncSession, table: models.TableSession) -> dict:
    participants = [
        row for row in await svc.participants_of(db, table.id)
        if not svc.is_bridge_occupant(row)
    ]
    return _public(
        table,
        participants,
        await svc.utterances_of(db, table.id),
        await _latest_recap(db, table.id),
        await svc.recording_stats(db, table.id, participants),
        await _character_names(db, participants),
        await _music_of(db, table.id),
    )


async def _music_of(db: AsyncSession, table_id: UUID) -> list[models.TableMusicSpan]:
    return list((await db.execute(
        select(models.TableMusicSpan)
        .where(models.TableMusicSpan.table_session_id == table_id)
        .order_by(models.TableMusicSpan.started_at.asc())
    )).scalars().all())


async def _latest_recap(db: AsyncSession, table_id: UUID) -> models.TableRecap | None:
    return (await db.execute(
        select(models.TableRecap)
        .where(models.TableRecap.table_session_id == table_id)
        .order_by(models.TableRecap.created_at.desc())
    )).scalars().first()


@router.get("/sessions/{session_id}/table")
async def get_table(
    session_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _owned_session(session_id, user, db)
    table = await svc.latest_table(db, session_id)
    if table is None:
        return None
    await svc.route_session_music(session_id, bool(table.music_enabled))
    return await _run_view(db, table)


@router.get("/sessions/{session_id}/table/runs")
async def list_runs(
    session_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _owned_session(session_id, user, db)
    return [await _run_view(db, table) for table in await svc.tables_of(db, session_id)]


@router.get("/scenarios/{scenario_id}/table-archive")
async def table_archive(
    scenario_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    from app.routes.scenarios.access import require_scenario_access
    from app.auth.permissions import PERM_READ

    scenario = await db.get(models.Scenario, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Сценарий не найден")
    await require_scenario_access(db, user, scenario, PERM_READ)
    approaches = []
    for session in await svc.approaches_for(db, scenario_id):
        approaches.append({
            "id": session.id,
            "name": session.name,
            "created_at": session.created_at,
            "runs": [await _run_view(db, table) for table in await svc.tables_of(db, session.id)],
        })
    return {"approaches": approaches}


@router.get("/scenarios/{scenario_id}/approaches/{session_id}/pack")
async def approach_pack(
    scenario_id: UUID,
    session_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    from urllib.parse import quote

    from app.auth.permissions import PERM_READ
    from app.routes.scenarios.access import require_scenario_access
    from app.services.approach_pack import build_approach_zip

    scenario = await db.get(models.Scenario, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Сценарий не найден")
    await require_scenario_access(db, user, scenario, PERM_READ)
    session = await db.get(models.GameSession, session_id)
    if session is None or scenario_id not in {session.scenario_id, session.launched_scenario_id}:
        raise HTTPException(status_code=404, detail="Подход не найден")
    payload, filename = await build_approach_zip(db, session)
    disposition = f"attachment; filename=\"approach.zip\"; filename*=UTF-8''{quote(filename)}"
    return Response(content=payload, media_type="application/zip", headers={"Content-Disposition": disposition})


@router.put("/sessions/{session_id}/table")
async def start_table(
    session_id: UUID,
    body: TableStart,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _owned_session(session_id, user, db)
    try:
        table = await svc.open_table(db, session_id, body.room_url, body.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    await svc.route_session_music(session_id, bool(table.music_enabled))
    return _public(table, [], [], None)


@router.post("/sessions/{session_id}/table/stop")
async def stop_table(
    session_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _owned_session(session_id, user, db)
    table = await svc.latest_table(db, session_id)
    if table is None:
        raise HTTPException(status_code=404, detail="Стол не запущен")
    table = await db.get(models.TableSession, table.id, with_for_update=True)
    if table is None:
        raise HTTPException(status_code=404, detail="Стол не запущен")
    table.status = "stopping"
    await db.commit()
    table.auto_connect = False
    await svc.route_session_music(session_id, False)
    return {"status": table.status, "status_label": _status_label(table.status)}


@router.post("/sessions/{session_id}/table/auto")
async def set_auto(
    session_id: UUID,
    body: AutoIn,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _owned_session(session_id, user, db)
    current = await svc.latest_table(db, session_id)
    if not body.enabled:
        if current is None:
            raise HTTPException(status_code=404, detail="Стол не запущен")
        current.auto_connect = False
        if current.status in svc.LIVE_STATUSES:
            current.status = "stopping"
        await db.commit()
        await svc.route_session_music(session_id, False)
        return await _run_view(db, current)
    url = (body.room_url or (current.room_url if current else "")).strip()
    if not url:
        raise HTTPException(status_code=400, detail="Сначала вставьте ссылку")
    password = body.password if body.password is not None else (current.password if current else None)
    try:
        table = await svc.open_table(db, session_id, url, password, auto_connect=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    table.auto_connect = True
    await db.commit()
    await svc.route_session_music(session_id, bool(table.music_enabled))
    return await _run_view(db, table)


@router.post("/sessions/{session_id}/table/music")
async def set_music(
    session_id: UUID,
    body: MusicIn,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _owned_session(session_id, user, db)
    table = await svc.latest_table(db, session_id)
    if table is None:
        raise HTTPException(status_code=404, detail="Стол не запущен")
    table.music_enabled = body.enabled
    await db.commit()
    await svc.route_session_music(session_id, body.enabled)
    return {"music_enabled": table.music_enabled}


@router.post("/sessions/{session_id}/table/test")
async def request_test(
    session_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _owned_session(session_id, user, db)
    table = await svc.latest_table(db, session_id)
    if table is None:
        raise HTTPException(status_code=404, detail="Сначала вставьте ссылку и войдите")
    if table.status not in svc.LIVE_STATUSES:
        table.status = "joining"
        table.left_at = None
        table.status_detail = None
    table.test_requested = True
    await db.commit()
    return {"pending": True, "test_report": table.test_report}


@router.patch("/sessions/{session_id}/table/participants/{participant_id}")
async def bind_character(
    session_id: UUID,
    participant_id: UUID,
    body: ParticipantPatch,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _owned_session(session_id, user, db)
    row = await db.get(models.TableParticipant, participant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Участник не найден")
    owner = await db.get(models.TableSession, row.table_session_id)
    if owner is None or owner.game_session_id != session_id:
        raise HTTPException(status_code=404, detail="Участник не найден")
    row.bind_kind = body.kind
    row.character_id = body.character_id if body.kind == "character" else None
    row.observer_code = (body.observer_code or "").strip() or None if body.kind == "observer" else None
    await svc.spread_binding(
        db,
        owner.game_session_id,
        row.display_name,
        row.bind_kind,
        row.character_id,
        row.observer_code,
    )
    await db.commit()
    return {
        "id": row.id,
        "character_id": row.character_id,
        "bind_kind": row.bind_kind,
        "observer_code": row.observer_code,
    }


@router.post("/sessions/{session_id}/table/recap")
async def create_recap(
    session_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _owned_session(session_id, user, db)
    table = await svc.latest_table(db, session_id)
    if table is None:
        raise HTTPException(status_code=404, detail="Стол не запущен")
    recap = await build_recap(db, table)
    await db.commit()
    return {"id": recap.id, "text": recap.text, "images": recap.images or []}


async def _lobby_master(lobby_id: UUID, user: models.User):
    from app.managers import lobby_manager

    manager = lobby_manager[str(lobby_id)]
    if not await manager.lobby_exists():
        raise HTTPException(status_code=404, detail="Лобби не найдено")
    if not await manager.is_master(user):
        raise HTTPException(status_code=403, detail="Только мастер лобби")
    return manager


@router.get("/lobbies/{lobby_id}/table")
async def lobby_table(
    lobby_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    manager = await _lobby_master(lobby_id, user)
    lobby = await manager.get_lobby()
    table = await svc.latest_preview(db, lobby_id)
    return {
        "room_url": lobby.jitsi_room_url or "",
        "music_enabled": bool(lobby.jitsi_music),
        "auto_connect": bool(lobby.jitsi_auto),
        "has_password": bool(lobby.jitsi_password),
        "table": None if table is None else await _run_view(db, table),
    }


@router.put("/lobbies/{lobby_id}/table")
async def lobby_start_table(
    lobby_id: UUID,
    body: LobbyTableStart,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    manager = await _lobby_master(lobby_id, user)
    lobby = await manager.set_jitsi(
        room_url=body.room_url.strip(),
        password=None if body.password is None else body.password,
    )
    table = None
    if body.enter:
        try:
            table = await svc.open_preview(
                db,
                lobby_id,
                lobby.jitsi_room_url,
                lobby.jitsi_password or None,
                bool(lobby.jitsi_music),
                bool(lobby.jitsi_auto),
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        await db.commit()
    return {
        "room_url": lobby.jitsi_room_url or "",
        "music_enabled": bool(lobby.jitsi_music),
        "auto_connect": bool(lobby.jitsi_auto),
        "has_password": bool(lobby.jitsi_password),
        "table": None if table is None else await _run_view(db, table),
    }


@router.post("/lobbies/{lobby_id}/table/stop")
async def lobby_stop_table(
    lobby_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    manager = await _lobby_master(lobby_id, user)
    await svc.discard_lobby_preview(db, lobby_id)
    await db.commit()
    lobby = await manager.get_lobby()
    return {
        "room_url": lobby.jitsi_room_url or "",
        "music_enabled": bool(lobby.jitsi_music),
        "auto_connect": bool(lobby.jitsi_auto),
        "has_password": bool(lobby.jitsi_password),
        "table": None,
    }


@router.post("/lobbies/{lobby_id}/table/auto")
async def lobby_auto(
    lobby_id: UUID,
    body: AutoIn,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    manager = await _lobby_master(lobby_id, user)
    lobby = await manager.set_jitsi(auto=body.enabled)
    table = None
    if body.enabled:
        if not (lobby.jitsi_room_url or "").strip():
            raise HTTPException(status_code=400, detail="Сначала вставьте ссылку")
        try:
            table = await svc.open_preview(
                db,
                lobby_id,
                lobby.jitsi_room_url,
                lobby.jitsi_password or None,
                bool(lobby.jitsi_music),
                True,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        await db.commit()
    else:
        await svc.discard_lobby_preview(db, lobby_id)
        await db.commit()
    return {
        "room_url": lobby.jitsi_room_url or "",
        "music_enabled": bool(lobby.jitsi_music),
        "auto_connect": bool(lobby.jitsi_auto),
        "has_password": bool(lobby.jitsi_password),
        "table": None if table is None else await _run_view(db, table),
    }


@router.post("/lobbies/{lobby_id}/table/music")
async def lobby_music(
    lobby_id: UUID,
    body: MusicIn,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    manager = await _lobby_master(lobby_id, user)
    lobby = await manager.set_jitsi(music=body.enabled)
    table = await svc.latest_preview(db, lobby_id)
    if table is not None and table.status in svc.LIVE_STATUSES:
        table.music_enabled = body.enabled
        await db.commit()
    return {"music_enabled": bool(lobby.jitsi_music)}


@router.post("/lobbies/{lobby_id}/table/test")
async def lobby_test(
    lobby_id: UUID,
    user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _lobby_master(lobby_id, user)
    table = await svc.latest_preview(db, lobby_id)
    if table is None:
        raise HTTPException(status_code=404, detail="Сначала вставьте ссылку и войдите")
    if table.status not in svc.LIVE_STATUSES:
        table.status = "joining"
        table.left_at = None
        table.status_detail = None
    table.test_requested = True
    await db.commit()
    return {"pending": True, "test_report": table.test_report}


@internal.get("")
async def active_tables(
    x_table_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _require_bridge(x_table_token)
    rows = (await db.execute(
        select(models.TableSession).where(models.TableSession.status.in_(svc.LIVE_STATUSES))
    )).scalars().all()
    payload = []
    for row in rows:
        payload.append({
            "id": str(row.id),
            "game_session_id": str(row.game_session_id) if row.game_session_id else "",
            "room_url": row.room_url,
            "domain": row.domain,
            "room_code": row.room_code,
            "password": row.password or "",
            "status": row.status,
            "music_enabled": bool(row.music_enabled),
            "auto_connect": bool(row.auto_connect),
            "test_requested": bool(row.test_requested),
            "audio": await svc.audio_snapshot(row.game_session_id) if row.game_session_id else None,
        })
    return payload


@internal.get("/{table_id}/mix")
async def mix_cursor(
    table_id: UUID,
    x_table_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _require_bridge(x_table_token)
    table = await _table_or_404(db, table_id)
    if table.preview or table.game_session_id is None:
        return {"audio": None}
    return {"audio": await svc.audio_snapshot(table.game_session_id)}


@internal.post("/{table_id}/mix")
async def mix_report(
    table_id: UUID,
    body: MixIn,
    x_table_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _require_bridge(x_table_token)
    table = await _table_or_404(db, table_id)
    if table.status == "discarded":
        return {"ok": True}
    for speaker in body.speakers:
        row = await svc.upsert_participant(db, table_id, speaker.jitsi_id, speaker.display_name)
        row.live_bytes = max(int(speaker.bytes), 0)
        row.live_seconds = max(float(speaker.seconds), 0.0)
    for jitsi_id in body.drop:
        row = (await db.execute(
            select(models.TableParticipant).where(
                models.TableParticipant.table_session_id == table_id,
                models.TableParticipant.jitsi_id == jitsi_id,
            )
        )).scalars().first()
        if row is None:
            continue
        saved = (await db.execute(
            select(models.TableSegment.id).where(models.TableSegment.participant_id == row.id).limit(1)
        )).first()
        if saved is None:
            await db.delete(row)
        else:
            row.live_bytes = 0
            row.live_seconds = 0
    await db.commit()
    return {"ok": True}


@internal.post("/{table_id}/music")
async def music_span(
    table_id: UUID,
    body: MusicSpanIn,
    x_table_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _require_bridge(x_table_token)
    table = await _table_or_404(db, table_id)
    if table.preview or table.status == "discarded":
        return {"ok": True}
    path = (body.path or "").strip()
    if path and ".." not in path:
        db.add(models.TableMusicSpan(
            table_session_id=table_id,
            path=path,
            started_at=body.started_at,
            ended_at=body.ended_at,
            position_start=max(body.position_start, 0),
            position_end=max(body.position_end, 0),
        ))
        await db.commit()
    return {"ok": True}


@internal.post("/{table_id}/status")
async def set_status(
    table_id: UUID,
    body: StatusIn,
    x_table_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _require_bridge(x_table_token)
    table = await db.get(models.TableSession, table_id, with_for_update=True)
    if table is None:
        raise HTTPException(status_code=404, detail="Стол не найден")
    allowed = {"joining", "live", "lobby", "stopping", "transcribing", "ready", "error"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail="Неизвестный статус")
    if table.status == "discarded":
        return {"ok": True}
    revive = (
        body.status == "joining"
        and table.auto_connect
        and table.status in ("error", "ready")
    )
    if not revive and table.status not in svc.LIVE_STATUSES and body.status in svc.LIVE_STATUSES:
        return {"ok": True}
    if revive:
        table.left_at = None
    table.status = body.status
    table.status_detail = body.detail
    now = datetime.now(timezone.utc)
    if body.status == "live" and table.joined_at is None:
        table.joined_at = now
    if body.status in ("ready", "transcribing", "error") and table.left_at is None and body.status != "error":
        table.left_at = now
    await db.commit()
    return {"ok": True}


@internal.post("/{table_id}/test")
async def save_test_report(
    table_id: UUID,
    body: TestReportIn,
    x_table_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _require_bridge(x_table_token)
    table = await _table_or_404(db, table_id)
    table.test_report = body.text
    table.test_requested = False
    await db.commit()
    return {"ok": True}


@internal.post("/{table_id}/participants")
async def report_participant(
    table_id: UUID,
    body: ParticipantIn,
    x_table_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _require_bridge(x_table_token)
    await _table_or_404(db, table_id)
    row = await svc.upsert_participant(db, table_id, body.jitsi_id, body.display_name)
    await db.commit()
    return {"id": str(row.id)}


@internal.post("/{table_id}/progress")
async def report_progress(
    table_id: UUID,
    body: ProgressIn,
    x_table_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _require_bridge(x_table_token)
    await _table_or_404(db, table_id)
    row = await svc.upsert_participant(db, table_id, body.jitsi_id, body.display_name)
    row.live_bytes = max(int(body.bytes), 0)
    row.live_seconds = max(float(body.seconds), 0.0)
    await db.commit()
    return {"ok": True}


@internal.post("/{table_id}/segments")
async def upload_segment(
    table_id: UUID,
    jitsi_id: str = Form(...),
    display_name: str = Form(""),
    started_at: datetime = Form(...),
    ended_at: datetime = Form(...),
    file: UploadFile = File(...),
    x_table_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _require_bridge(x_table_token)
    table = await _table_or_404(db, table_id)
    if table.preview or table.status == "discarded":
        return {"ok": True, "preview": table.preview}
    participant = await svc.upsert_participant(db, table_id, jitsi_id, display_name)
    payload = await file.read()
    folder = svc.segment_dir()
    segment = models.TableSegment(
        table_session_id=table_id,
        participant_id=participant.id,
        file_path="",
        real_started_at=started_at,
        real_ended_at=ended_at,
        status="pending",
    )
    db.add(segment)
    await db.flush()
    relative = f"table/segments/{segment.id}.ogg"
    (folder / f"{segment.id}.ogg").write_bytes(payload)
    segment.file_path = relative
    participant.live_bytes = 0
    participant.live_seconds = 0
    await db.commit()
    try:
        from app.infrastructure.rabbitmq import publish_table_asr
        await publish_table_asr(str(segment.id))
    except Exception:
        pass
    return {"id": str(segment.id)}
