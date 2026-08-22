from fastapi import APIRouter, Depends
from app.auth.role import require_admin
from app.plugins.registry_singleton import registry

router = APIRouter(prefix="/rulesystems", tags=["rulesystems"])

@router.get("")
def list_rulesystems():
    return registry.list()

@router.post("/reload", dependencies=[Depends(require_admin)])
def reload_rulesystems():
    registry.reload()
    return {"ok": True, "count": len(registry.list())}
