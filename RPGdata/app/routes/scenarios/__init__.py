from .routes import router 
from .full import router as full_router
from .export import router as export_router
# from .entities import router as entities_router


scenarios_routers = [router, full_router, export_router]