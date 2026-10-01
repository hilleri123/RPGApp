"""Снимок сценария должен сразу грузить template_npc / template_item / audio_track.

Без этого session/архив падали на LocationOut.model_validate с MissingGreenlet:
ленивая подгрузка внутри async-сессии невозможна.
"""

import importlib
import uuid


def _option_paths(stmt) -> list[str]:
    return [str(getattr(opt, "path", "")) for opt in stmt._with_options]


def test_scenario_load_stmt_eager_loads_exposure_links():
    importlib.import_module("app.main")
    from app.services.scenario_cloner import _scenario_load_stmt

    paths = _option_paths(_scenario_load_stmt(uuid.uuid4()))
    for owner in ("Location.scene_exposures", "StoryBeat.scene_exposures"):
        for needle in (
            "SceneExposureTemplateNPC.template_npc",
            "SceneExposureTemplateItem.template_item",
            "SceneExposureAudio.audio_track",
        ):
            assert any(owner in p and needle in p for p in paths), (
                f"{owner}: не загружается заранее {needle}"
            )
