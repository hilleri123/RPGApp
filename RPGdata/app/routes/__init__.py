from app.routes.auth import auth_router
from app.routes.user import user_router
from app.routes.scenarios import scenarios_routers
from app.routes.rules import rulesystem_router, config_router
from .game_items import router as item_router 
from .characters import router as characters_router
from .npcs import router as npcs_router
from app.routes.websocket import session_router, lobby_router, observer_router
from app.routes.images import image_routers
from app.routes.access_groups import access_groups_routers
from .counters import router as counter_router
from .notes import router as notes_router
from .story_beat import router as story_beat_router
from .locations import router as location_router
from .location_library import router as location_library_router
from .scenario_search import router as scenario_search_router
from .template_sets import routers as template_routers
from .audio import router as audio_router
from .scenario_todo import router as todo_router
from .applications import router as applications_router
from .entity_packs.routes import router as entity_packs_router
from .name_packs.routes import router as name_packs_router
from .master_applications import router as master_applications_router
from .campaigns import router as campaigns_router
from .launched_scenarios import router as launched_scenarios_router
from .entity_lineage import router as entity_lineage_router
from .scenario_tags import router as scenario_tags_router
from .fronts import router as fronts_router


routers = [
    location_library_router,
    scenario_search_router,
    location_router,
    auth_router,
    user_router,
    rulesystem_router, config_router,
    item_router,
    characters_router, npcs_router,
    session_router, lobby_router, observer_router,
    counter_router, notes_router,
    story_beat_router,
    audio_router,
    todo_router,
    applications_router,
    master_applications_router,
    entity_packs_router,
    name_packs_router,
    campaigns_router,
    launched_scenarios_router,
    entity_lineage_router,
    scenario_tags_router,
    fronts_router,
] + scenarios_routers + access_groups_routers + image_routers + template_routers