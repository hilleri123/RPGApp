# app/routes/scenarios/export.py
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import require_master
from app.auth.permissions import PERM_READ
from app.infrastructure.database import get_async_session as get_db
from app.infrastructure.pdf_export import ScenarioPDFExporter
from app.routes.scenarios.access import require_scenario_access
from app.services.scenario_archive import (
    ArchiveFormatError,
    export_scenario_archive,
    import_scenario_archive,
)

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("/{scenario_id}/export/pdf")
async def export_scenario_pdf(
    scenario_id: UUID,
    include_master: bool = True,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    """Экспортирует сценарий в PDF"""
    exporter = ScenarioPDFExporter()
    pdf_io = await exporter.export_scenario(db, scenario_id, include_master)

    pdf_io.seek(0)

    return StreamingResponse(
        pdf_io,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="scenario_{scenario_id}.pdf"'
        },
    )


@router.get("/{scenario_id}/export/archive")
async def export_scenario_archive_endpoint(
    scenario_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    """Экспортирует сценарий в ZIP (JSON + медиа)."""
    result = await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    scenario = result.scalars().first()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    await require_scenario_access(db, current_user, scenario, PERM_READ)

    try:
        zip_io = await export_scenario_archive(db, scenario_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    slug = "".join(c if c.isalnum() or c in "-_" else "_" for c in (scenario.name or "scenario"))[:48]
    filename = f"scenario_{slug}_{scenario_id}.zip"

    return StreamingResponse(
        zip_io,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import/archive")
async def import_scenario_archive_endpoint(
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    """Импортирует сценарий из ZIP-архива (idempotent skip-if-exists)."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Ожидается .zip файл")

    zip_bytes = await file.read()
    if not zip_bytes:
        raise HTTPException(status_code=400, detail="Пустой файл")

    try:
        report = await import_scenario_archive(db, zip_bytes, owner_user_id=current_user.id)
    except ArchiveFormatError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if report.imported:
        await db.commit()
    else:
        await db.rollback()

    return report.to_dict()
