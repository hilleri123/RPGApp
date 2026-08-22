from __future__ import annotations

from typing import Any


def manager_init(manager: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    ctx = context or {}
    init_fn = getattr(manager, "init", None)
    if callable(init_fn):
        return init_fn(ctx)

    config_fn = getattr(manager, "config", None)
    if callable(config_fn):
        cfg = config_fn(ctx)
        if isinstance(cfg, dict):
            initial = cfg.get("initialData")
            if isinstance(initial, dict):
                return initial

    return {}


def manager_schema(manager: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    schema_fn = getattr(manager, "schema", None)
    if callable(schema_fn):
        return schema_fn(context)

    cfg = manager.config(context or {})
    if not isinstance(cfg, dict):
        return {}
    return {k: v for k, v in cfg.items() if k != "initialData"}


def manager_options(manager: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    options_fn = getattr(manager, "options", None)
    if callable(options_fn):
        return options_fn(context or {})
    return {}


def manager_config(manager: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    ctx = context or {}
    return {
        **manager_schema(manager, ctx),
        "initialData": manager_init(manager, ctx),
    }


def dispatch_manager_kind(
    manager: Any,
    kind: str,
    payload: Any,
    context: dict[str, Any] | None = None,
) -> Any:
    ctx = context if isinstance(context, dict) else {}

    if kind == "init":
        return manager_init(manager, ctx)

    if kind == "schema":
        return manager_schema(manager, ctx)

    if kind == "options":
        return manager_options(manager, ctx)

    if kind == "config":
        return manager_config(manager, ctx)

    if kind == "validate":
        result = manager.validate_and_enrich(payload, ctx)
        if hasattr(result, "model_dump"):
            return result.model_dump(mode="json")
        if hasattr(result, "dict"):
            return result.dict()
        return result

    if kind == "dump.html":
        if hasattr(manager, "dump_html"):
            return manager.dump_html(payload or {}, ctx)
        return ""

    raise ValueError(f"Unknown manager kind: {kind}")
