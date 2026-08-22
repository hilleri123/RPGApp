# managers/audio_manager.py

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from app import scheme
from app import models
from app.logger import logger
from app.infrastructure.database import get_async_session as get_db
from app.managers.session.factory_manager import FactoryManager


class AudioManager(FactoryManager):
    """Управление аудио-очередью сессии."""

    # ── helpers ───────────────────────────────────────────────────────────

    def _build_audio_reason(
        self,
        inner: scheme.GameSessionInner,
        exposure: scheme.InnerSceneExposure,
        from_location_id: Optional[UUID],
        from_story_beat: Optional[UUID],
        scene: Optional[scheme.SceneInner],
    ) -> scheme.AudioQueueReason:
        if from_location_id:
            loc = next((l for l in (inner.locations or []) if l.id == from_location_id), None)
            return scheme.AudioQueueReason(
                exposure_id=exposure.id,
                exposure_name=exposure.name,
                source_type="location",
                source_name=loc.name if loc else str(from_location_id),
                source_id=from_location_id,
                scene_name=getattr(scene, "name", None),
                scene_id=getattr(scene, "id", None),
            )

        if from_story_beat:
            beat = next((b for b in (inner.story_beats or []) if b.id == from_story_beat), None)
            return scheme.AudioQueueReason(
                exposure_id=exposure.id,
                exposure_name=exposure.name,
                source_type="story_beat",
                source_name=beat.name if beat else str(from_story_beat),
                source_id=from_story_beat,
                scene_name=getattr(scene, "name", None),
                scene_id=getattr(scene, "id", None),
            )

        # fallback
        return scheme.AudioQueueReason(
            exposure_id=exposure.id,
            exposure_name=exposure.name,
            source_type="location",
            source_name="",
            source_id=from_location_id or from_story_beat or uuid.uuid4(),
            scene_name=getattr(scene, "name", None),
            scene_id=getattr(scene, "id", None),
        )

    async def _resolve_audio_track(
        self,
        inner: scheme.GameSessionInner,
        track_id,
    ) -> scheme.AudioTrackOut | None:
        track = next((t for t in (inner.audio or []) if str(t.id) == str(track_id)), None)
        if track:
            return track

        async for db in get_db():
            row = await db.get(models.AudioTrack, track_id)
            if not row:
                return None
            return scheme.AudioTrackOut.model_validate(row)
        return None

    # ── public API ────────────────────────────────────────────────────────

    async def apply_exposure_audio(
        self,
        inner: scheme.GameSessionInner,
        exposure: scheme.InnerSceneExposure,
        from_location_id: Optional[UUID],
        from_story_beat: Optional[UUID],
        scene: Optional[scheme.SceneInner],
    ) -> bool:
        """
        Добавляет треки экспозиции в очередь.
        Принимает уже загруженный inner (не делает get_inner сам).
        Возвращает True если были добавлены треки.
        """
        if not exposure.audio_links:
            return False

        audio_by_id = {str(t.id): t for t in (inner.audio or [])}
        reason = self._build_audio_reason(inner, exposure, from_location_id, from_story_beat, scene)

        new_entries: list[scheme.AudioQueueEntry] = []
        for link in exposure.audio_links:
            track = audio_by_id.get(str(link.audio_track_id))
            if not track:
                logger.warning("AudioManager: track not found: %s", link.audio_track_id)
                continue

            entry = scheme.AudioQueueEntry(
                id=uuid.uuid4(),
                audio_track_id=link.audio_track_id,
                track_name=track.name,
                track_url=track.url,
                track_duration=getattr(track, "duration", None),
                volume=link.volume,
                loop=link.loop,
                fade_in=link.fade_in,
                fade_out=link.fade_out,
                added_at=datetime.now(timezone.utc),
                played=False,
                reason=reason,
            )
            new_entries.append(entry)

        if not new_entries:
            return False

        inner.audio_queue = list(inner.audio_queue or []) + new_entries
        return True

    async def audio_command(
        self,
        current_user: models.User,
        command: str,
        entry_id: Optional[UUID] = None,
        extra: dict = {},
    ) -> tuple[bool, list[str]]:
        inner = await self.get_inner()
        queue = list(inner.audio_queue or [])
        p = inner.audio_player  # короткий алиас

        if command == "play_entry" and entry_id:
            for e in queue:
                if e.id == entry_id:
                    e.played = True
            p.current_entry_id = entry_id
            p.playing = True
            p.position_sec = 0.0
            p.position_at = datetime.now(timezone.utc)

        elif command == "play":
            if not p.current_entry_id:
                nxt = next((e for e in queue if not e.played), None)
                if nxt:
                    nxt.played = True
                    p.current_entry_id = nxt.id
                    p.position_sec = 0.0
            p.playing = True
            p.position_at = datetime.now(timezone.utc)

        elif command == "pause":
            # сохраняем позицию перед паузой
            p.position_sec = p.effective_position()
            p.position_at = None
            p.playing = False

        elif command == "stop":
            p.playing = False
            p.current_entry_id = None
            p.position_sec = 0.0
            p.position_at = None

        elif command == "clear_queue":
            inner.audio_queue = []
            p.playing = False
            p.current_entry_id = None
            p.position_sec = 0.0
            p.position_at = None
            queue = []

        elif command == "set_volume":
            p.volume = max(0.0, min(2.0, extra.get("volume", 1.0)))

        elif command == "sync_position":
            p.position_sec = max(0.0, extra.get("position_sec", 0.0))
            p.position_at = datetime.now(timezone.utc)

        elif command == "enqueue_track":
            track_id = extra.get("audio_track_id")
            if not track_id:
                return False, []
            track = await self._resolve_audio_track(inner, track_id)
            if not track:
                return False, []
            entry = scheme.AudioQueueEntry(
                id=uuid.uuid4(),
                audio_track_id=track.id,
                track_name=track.name,
                track_url=track.url,
                track_duration=getattr(track, "duration", None),
                volume=0.5,
                loop=True,
                fade_in=2.0,
                fade_out=2.0,
                added_at=datetime.now(timezone.utc),
                played=bool(extra.get("play", True)),
                reason=scheme.AudioQueueReason(
                    exposure_id=uuid.uuid4(),
                    exposure_name="Библиотека",
                    source_type="location",
                    source_name=track.name,
                    source_id=track.id,
                ),
            )
            queue.append(entry)
            if extra.get("play", True):
                p.current_entry_id = entry.id
                p.playing = True
                p.position_sec = 0.0
                p.position_at = datetime.now(timezone.utc)

        inner.audio_queue = queue
        await self.set_inner(inner)
        return True, ["audio_player", "audio_queue"]

    async def enqueue_audio_track(
        self,
        current_user: models.User,
        audio_track_id: UUID,
        *,
        play: bool = True,
    ) -> tuple[bool, list[str]]:
        return await self.audio_command(
            current_user,
            "enqueue_track",
            extra={"audio_track_id": audio_track_id, "play": play},
        )