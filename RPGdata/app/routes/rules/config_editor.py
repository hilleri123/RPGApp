from __future__ import annotations

from uuid import UUID
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Body, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database import get_async_session as get_db
from app.auth import get_current_user
from app.auth.permissions import PERM_READ
from app import models
from app.routes._helpers import require_scenario_by_id
from app.services.name_generators import enrich_editor_schema_with_name_packs
from plugins.common.types.editor import EditorInitContext, EditorOptionsContext
from .schema_helpers import (
    compute_schema_etag,
    factory_handle,
    plugin_meta_by_rule_id,
    resolve_plugin_meta_for_scenario,
    resolve_plugin_meta_for_template_set,
)


# Роутер отдаёт схемы редакторов, дефолты и опции. Без аутентификации аноним
# перебором UUID вытягивал структуру и справочные данные чужих сценариев.
router = APIRouter(
    prefix="",
    tags=["rules"],
    dependencies=[Depends(get_current_user)],
)


def _schema_response(
    *,
    schema: dict[str, Any],
    plugin_id: str,
    plugin_version: str,
    request: Request,
) -> Response:
    etag = compute_schema_etag(schema, plugin_version)
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=304,
            headers={
                "ETag": etag,
                "X-Plugin-Id": plugin_id,
                "X-Plugin-Version": plugin_version,
            },
        )

    return JSONResponse(
        content=schema,
        headers={
            "ETag": etag,
            "X-Plugin-Id": plugin_id,
            "X-Plugin-Version": plugin_version,
            "Cache-Control": "private, max-age=3600",
        },
    )


async def _editor_config_core(
    *,
    db: AsyncSession,
    scenario_id: Optional[UUID],
    template_set_id: Optional[UUID],
    entity: str,
    context: Dict[str, Any],
):
    init_ctx = EditorInitContext.from_raw(context).to_manager_context()
    return await factory_handle(
        db=db,
        scenario_id=scenario_id,
        template_set_id=template_set_id,
        rule_id_str=None,
        entity=entity,
        kind="config",
        context=init_ctx,
    )


@router.get("/scenarios/{scenario_id}/{entity}/schema")
async def editor_schema_for_scenario(
    scenario_id: UUID,
    entity: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await require_scenario_by_id(db, current_user, scenario_id, PERM_READ)

    plugin_id, plugin_version = await resolve_plugin_meta_for_scenario(db, scenario_id)
    schema = await factory_handle(
        db=db,
        scenario_id=scenario_id,
        template_set_id=None,
        rule_id_str=None,
        entity=entity,
        kind="schema",
        context={},
    )
    schema = await enrich_editor_schema_with_name_packs(db, schema, scenario_id=scenario_id)
    return _schema_response(
        schema=schema,
        plugin_id=plugin_id,
        plugin_version=plugin_version,
        request=request,
    )


@router.get("/template_sets/{template_set_id}/{entity}/schema")
async def editor_schema_for_template_set(
    template_set_id: UUID,
    entity: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    plugin_id, plugin_version = await resolve_plugin_meta_for_template_set(db, template_set_id)
    schema = await factory_handle(
        db=db,
        scenario_id=None,
        template_set_id=template_set_id,
        rule_id_str=None,
        entity=entity,
        kind="schema",
        context={},
    )
    return _schema_response(
        schema=schema,
        plugin_id=plugin_id,
        plugin_version=plugin_version,
        request=request,
    )


@router.get("/rules/{rule_id_str}/schema/{entity}")
async def editor_schema_by_rule_id(
    rule_id_str: str,
    entity: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    plugin_id, plugin_version = plugin_meta_by_rule_id(rule_id_str)
    schema = await factory_handle(
        db=db,
        scenario_id=None,
        template_set_id=None,
        rule_id_str=rule_id_str,
        entity=entity,
        kind="schema",
        context={},
    )
    return _schema_response(
        schema=schema,
        plugin_id=plugin_id,
        plugin_version=plugin_version,
        request=request,
    )


@router.post("/scenarios/{scenario_id}/{entity}/init")
async def editor_init_for_scenario(
    scenario_id: UUID,
    entity: str,
    context: Dict[str, Any] = Body(default={}),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await require_scenario_by_id(db, current_user, scenario_id, PERM_READ)

    init_ctx = EditorInitContext.from_raw(context)
    init_ctx.scenario_id = scenario_id
    return await factory_handle(
        db=db,
        scenario_id=scenario_id,
        template_set_id=None,
        rule_id_str=None,
        entity=entity,
        kind="init",
        context=init_ctx.to_manager_context(),
    )


@router.post("/template_sets/{template_set_id}/{entity}/init")
async def editor_init_for_template_set(
    template_set_id: UUID,
    entity: str,
    context: Dict[str, Any] = Body(default={}),
    db: AsyncSession = Depends(get_db),
):
    init_ctx = EditorInitContext.from_raw(context)
    init_ctx.template_set_id = template_set_id
    return await factory_handle(
        db=db,
        scenario_id=None,
        template_set_id=template_set_id,
        rule_id_str=None,
        entity=entity,
        kind="init",
        context=init_ctx.to_manager_context(),
    )


@router.post("/rules/{rule_id_str}/init/{entity}")
async def editor_init_by_rule_id(
    rule_id_str: str,
    entity: str,
    context: Dict[str, Any] = Body(default={}),
    db: AsyncSession = Depends(get_db),
):
    init_ctx = EditorInitContext.from_raw(context).to_manager_context()
    return await factory_handle(
        db=db,
        scenario_id=None,
        template_set_id=None,
        rule_id_str=rule_id_str,
        entity=entity,
        kind="init",
        context=init_ctx,
    )


@router.post("/scenarios/{scenario_id}/{entity}/options")
async def editor_options_for_scenario(
    scenario_id: UUID,
    entity: str,
    context: Dict[str, Any] = Body(default={}),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await require_scenario_by_id(db, current_user, scenario_id, PERM_READ)

    options_ctx = EditorOptionsContext.from_raw(context)
    options_ctx.scenario_id = scenario_id
    return await factory_handle(
        db=db,
        scenario_id=scenario_id,
        template_set_id=None,
        rule_id_str=None,
        entity=entity,
        kind="options",
        context=options_ctx.to_manager_context(),
    )


@router.post("/template_sets/{template_set_id}/{entity}/options")
async def editor_options_for_template_set(
    template_set_id: UUID,
    entity: str,
    context: Dict[str, Any] = Body(default={}),
    db: AsyncSession = Depends(get_db),
):
    options_ctx = EditorOptionsContext.from_raw(context)
    options_ctx.template_set_id = template_set_id
    return await factory_handle(
        db=db,
        scenario_id=None,
        template_set_id=template_set_id,
        rule_id_str=None,
        entity=entity,
        kind="options",
        context=options_ctx.to_manager_context(),
    )


@router.post("/rules/{rule_id_str}/options/{entity}")
async def editor_options_by_rule_id(
    rule_id_str: str,
    entity: str,
    context: Dict[str, Any] = Body(default={}),
    db: AsyncSession = Depends(get_db),
):
    options_ctx = EditorOptionsContext.from_raw(context).to_manager_context()
    return await factory_handle(
        db=db,
        scenario_id=None,
        template_set_id=None,
        rule_id_str=rule_id_str,
        entity=entity,
        kind="options",
        context=options_ctx,
    )


@router.post("/scenarios/{scenario_id}/{entity}/config")
async def editor_config_for_scenario(
    scenario_id: UUID,
    entity: str,
    context: Dict[str, Any] = Body(default={}),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Deprecated: use GET /schema + POST /init + POST /options."""
    await require_scenario_by_id(db, current_user, scenario_id, PERM_READ)

    return await _editor_config_core(
        db=db,
        scenario_id=scenario_id,
        template_set_id=None,
        entity=entity,
        context=context,
    )


@router.post("/template_sets/{template_set_id}/{entity}/config")
async def editor_config_for_template_set(
    template_set_id: UUID,
    entity: str,
    context: Dict[str, Any] = Body(default={}),
    db: AsyncSession = Depends(get_db),
):
    """Deprecated: use GET /schema + POST /init + POST /options."""
    return await _editor_config_core(
        db=db,
        scenario_id=None,
        template_set_id=template_set_id,
        entity=entity,
        context=context,
    )


@router.get("/rules/{rule_id_str}/editor-config/{entity}")
async def editor_config_by_rule_id(
    rule_id_str: str,
    entity: str,
    db: AsyncSession = Depends(get_db),
):
    """Deprecated: use GET /schema + POST /init."""
    return await factory_handle(
        db=db,
        scenario_id=None,
        template_set_id=None,
        rule_id_str=rule_id_str,
        entity=entity,
        kind="config",
        context={},
    )
