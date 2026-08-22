from .character_templates import router as c_router
from .item_templates import router as i_router
from .npc_templates import router as n_router
from .scenatio_scoped import router as s_router

routers = [c_router, i_router, n_router, s_router]