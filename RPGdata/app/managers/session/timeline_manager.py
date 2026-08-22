from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Tuple

from app import scheme


def format_game_time(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def parse_game_time(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class SessionTimelineManager:
    async def set_session_time(self, time: str) -> Tuple[bool, list[str]]:
        parsed = parse_game_time(time)
        if parsed is None:
            return False, []

        runtime = await self.get_runtime()
        timeline = runtime.timeline.model_copy(update={"current_time": parsed})
        runtime.timeline = timeline
        await self.set_runtime(runtime)
        return True, ["timeline"]

    async def refresh_timeline_scenario_start(self) -> None:
        inner = await self.get_inner()
        starts = inner.scenario_starts_at
        if not starts:
            return

        runtime = await self.get_runtime()
        updates: dict = {"scenario_started_at": starts}
        if runtime.timeline.current_time is None:
            updates["current_time"] = starts
        runtime.timeline = runtime.timeline.model_copy(update=updates)
        await self.set_runtime(runtime)

    def session_game_time_str(self, inner: scheme.GameSessionInner) -> Optional[str]:
        current = inner.timeline.current_time if inner.timeline else None
        if current is None:
            current = inner.scenario_starts_at
        return format_game_time(current)

    def inherit_scene_game_time(
        self,
        inner: scheme.GameSessionInner,
        *,
        parent_scene: scheme.SceneInner | None = None,
    ) -> Optional[str]:
        if parent_scene is not None:
            if parent_scene.datetime:
                return parent_scene.datetime
            return self.session_game_time_str(inner)
        return self.session_game_time_str(inner)
