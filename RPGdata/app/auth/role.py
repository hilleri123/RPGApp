from fastapi import Depends, HTTPException, status

from .user import get_current_user
from app import models

# Re-export permission helpers for backward compatibility.
from .permissions import (  # noqa: F401
    PERM_ALL,
    PERM_EDIT_FULL,
    PERM_EDIT_PARTIAL,
    PERM_NONE,
    PERM_READ,
    can_copy_scenario,
    can_delete_scenario,
    can_edit_scenario_entities,
    can_edit_scenario_meta,
    can_view_scenario,
    get_max_permission_for_user,
    get_scenario_permission,
    has_at_least,
    normalize_permission,
)


async def require_master(user: models.User = Depends(get_current_user)):
    # Администратор считается мастером: в permissions.py он и так получает
    # полный доступ к любому сценарию, иначе он ловил бы 403 на ровном месте.
    if not (user.can_be_master or user.is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется роль master")
    return user


async def require_admin(user: models.User = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется роль admin")
    return user
