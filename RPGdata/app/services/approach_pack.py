"""Папка одного подхода: мир, хроника, стенограмма, речь и сыгранная музыка."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.services.table_session import (
    MEDIA_ROOT,
    is_bridge_occupant,
    participants_of,
    recording_stats,
    tables_of,
    utterances_of,
)


PROMPT = """По этой папке напиши рассказ о сессии и короткое саммари.

world.md — персонажи, NPC, локации и заметки.
chronicle.md — хроника.
runs — стенограммы, кто говорил и какая музыка играла.
speech — записи речи.
music — файлы, которые реально звучали.
"""


def safe_name(value: str | None, fallback: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in " ._-" else "_" for ch in (value or ""))
    while ".." in cleaned:
        cleaned = cleaned.replace("..", "_")
    cleaned = cleaned.strip(" .") or fallback
    return cleaned[:80]


def media_file(relative: str | None) -> Path | None:
    if not relative:
        return None
    parts = Path(relative).parts
    if not parts or any(part in ("..", "") for part in parts):
        return None
    root = MEDIA_ROOT.resolve()
    path = (MEDIA_ROOT / relative).resolve()
    if root != path and root not in path.parents:
        return None
    if not path.is_file():
        return None
    return path


def _block(title: str, lines: list[str]) -> str:
    body = "\n".join(line for line in lines if line is not None)
    return f"# {title}\n\n{body}\n" if body else f"# {title}\n\nПусто.\n"


def world_text(characters, npcs, locations, notes) -> str:
    parts = ["# Мир подхода\n"]
    parts.append(_block("Персонажи", [
        f"## {row.name}\n{(row.short_desc or '').strip()}\n{(row.story or '').strip()}".strip()
        for row in characters
    ]))
    parts.append(_block("NPC", [
        f"## {row.name}\n{(row.description_for_players or '').strip()}\n{(row.description_for_master or '').strip()}".strip()
        for row in npcs
    ]))
    parts.append(_block("Локации", [
        f"## {row.name}\n{(row.description_for_players or '').strip()}\n{(row.description_for_master or '').strip()}".strip()
        for row in locations
    ]))
    parts.append(_block("Заметки", [
        f"## {row.name}\n{(row.text or '').strip()}".strip()
        for row in notes
    ]))
    return "\n".join(parts)


def chronicle_text(lines) -> str:
    rows = []
    for line in lines:
        stamp = line.game_time or ""
        when = stamp + " " if stamp else ""
        rows.append(f"- {when}{line.text}".rstrip())
    return _block("Хроника", rows)


def _bind(row, names: dict) -> str:
    kind = getattr(row, "bind_kind", "") or ""
    jitsi = (row.display_name or "").strip()
    role = ""
    if kind == "master":
        role = "Мастер"
    elif kind == "observer" and row.observer_code:
        role = f"Наблюдатель {row.observer_code}"
    elif row.character_id and names.get(row.character_id):
        role = names[row.character_id]
    if jitsi and role and role != jitsi:
        return f"{jitsi} — {role}"
    return role or jitsi or row.jitsi_id or "участник"


async def _names(db: AsyncSession, participants) -> dict:
    ids = [row.character_id for row in participants if row.character_id]
    if not ids:
        return {}
    rows = (await db.execute(
        select(models.PlayerCharacter).where(models.PlayerCharacter.id.in_(ids))
    )).scalars().all()
    return {row.id: row.name for row in rows}


async def build_approach_zip(db: AsyncSession, session: models.GameSession) -> tuple[bytes, str]:
    world_id = session.launched_scenario_id or session.scenario_id
    characters, npcs, locations, notes, chronicle = [], [], [], [], []
    if world_id is not None:
        characters = list((await db.execute(
            select(models.PlayerCharacter)
            .where(models.PlayerCharacter.scenario_id == world_id)
            .order_by(models.PlayerCharacter.name.asc())
        )).scalars().all())
        npcs = list((await db.execute(
            select(models.NPC).where(models.NPC.scenario_id == world_id).order_by(models.NPC.name.asc())
        )).scalars().all())
        locations = list((await db.execute(
            select(models.Location).where(models.Location.scenario_id == world_id).order_by(models.Location.name.asc())
        )).scalars().all())
        notes = list((await db.execute(
            select(models.Note).where(models.Note.scenario_id == world_id).order_by(models.Note.name.asc())
        )).scalars().all())
        chronicle = list((await db.execute(
            select(models.ChronicleLine)
            .where(models.ChronicleLine.scenario_id == world_id)
            .order_by(models.ChronicleLine.real_at.asc())
        )).scalars().all())

    buffer = io.BytesIO()
    music_added: set[str] = set()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("prompt.txt", PROMPT)
        archive.writestr("world.md", world_text(characters, npcs, locations, notes))
        archive.writestr("chronicle.md", chronicle_text(chronicle))
        runs = await tables_of(db, session.id)
        if not runs:
            archive.writestr("runs/README.txt", "Запусков стола у этого подхода нет.\n")
        for index, table in enumerate(runs, start=1):
            folder = f"runs/{index:02d}"
            participants = [row for row in await participants_of(db, table.id) if not is_bridge_occupant(row)]
            names = await _names(db, participants)
            labels = {row.id: _bind(row, names) for row in participants}
            stats = await recording_stats(db, table.id, participants)
            by_id = {item["participant_id"]: item for item in stats["participants"]}
            who = [
                f"- {labels.get(row.id, row.display_name)}: {by_id.get(row.id, {}).get('bytes', 0)} байт, {by_id.get(row.id, {}).get('seconds', 0):.0f} с"
                for row in participants
            ]
            utterances = await utterances_of(db, table.id)
            said = []
            for line in utterances:
                who_name = labels.get(line.participant_id, "участник")
                stamp = f" [{line.game_time}]" if line.game_time else ""
                said.append(f"- {who_name}{stamp}: {line.text}")
            archive.writestr(f"{folder}/transcript.md", _block("Кто говорил", who) + "\n" + _block("Стенограмма", said))

            spans = list((await db.execute(
                select(models.TableMusicSpan)
                .where(models.TableMusicSpan.table_session_id == table.id)
                .order_by(models.TableMusicSpan.started_at.asc())
            )).scalars().all())
            music_lines = []
            for span in spans:
                stored = media_file(span.path)
                arc = ""
                if stored is not None:
                    arc_name = "music/" + safe_name(span.path.replace("/", "_"), stored.name)
                    if arc_name not in music_added:
                        archive.write(stored, arc_name)
                        music_added.add(arc_name)
                    arc = f" ({arc_name})"
                music_lines.append(
                    f"- {span.path}{arc}: {span.position_start:.1f}–{span.position_end:.1f} с"
                )
            archive.writestr(f"{folder}/music.md", _block("Музыка", music_lines))

            segments = list((await db.execute(
                select(models.TableSegment)
                .where(models.TableSegment.table_session_id == table.id)
                .order_by(models.TableSegment.real_started_at.asc())
            )).scalars().all())
            spoken = 0
            for segment in segments:
                stored = media_file(segment.file_path)
                if stored is None:
                    continue
                spoken += 1
                person = labels.get(segment.participant_id, "участник")
                archive.write(stored, f"{folder}/speech/{spoken:02d}-{safe_name(person, 'voice')}.ogg")

    title = safe_name(session.name, "approach")
    return buffer.getvalue(), f"{title}.zip"
