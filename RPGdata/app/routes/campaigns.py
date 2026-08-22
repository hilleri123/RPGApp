from uuid import UUID
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, scheme
from app.auth import require_master, get_current_user
from app.infrastructure.database import get_async_session as get_db
from app.managers import lobby_manager
from app.services import campaign_service

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=list[scheme.CampaignOut])
@router.get("/", response_model=list[scheme.CampaignOut])
async def list_campaigns(
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    return await campaign_service.list_campaigns(db, current_user.id)


@router.post("", response_model=scheme.CampaignOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=scheme.CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: scheme.CampaignCreate,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    return await campaign_service.create_campaign(db, master_id=current_user.id, payload=payload)


@router.get("/profile/me", response_model=scheme.CampaignProfileOut)
async def my_campaign_profile(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await campaign_service.get_profile(db, current_user.id)


@router.get("/{campaign_id}", response_model=scheme.CampaignOut)
async def get_campaign(
    campaign_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    out = await campaign_service.get_campaign(db, campaign_id, current_user.id)
    if not out:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return out


@router.patch("/{campaign_id}", response_model=scheme.CampaignOut)
async def update_campaign(
    campaign_id: UUID,
    payload: scheme.CampaignUpdate,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    out = await campaign_service.update_campaign(
        db, campaign_id=campaign_id, master_id=current_user.id, payload=payload
    )
    if not out:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return out


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    ok = await campaign_service.delete_campaign(db, campaign_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Campaign not found")


@router.post("/{campaign_id}/start-session", response_model=scheme.SessionRedirect)
async def start_campaign_session(
    campaign_id: UUID,
    payload: scheme.CampaignStartSessionIn,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    campaign = await campaign_service._load_campaign(db, campaign_id)
    if not campaign or campaign.master_id != current_user.id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    lobby = None
    if payload.lobby_id:
        lobby_m = lobby_manager[payload.lobby_id]
        if not await lobby_m.lobby_exists():
            raise HTTPException(status_code=404, detail="Lobby not found")
        lobby = await lobby_m.get_lobby()
        if str(lobby.master.id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not lobby master")

    if lobby is None:
        lobby = scheme.Lobby(
            id=UUID(int=0),
            name=campaign.name,
            max_players=8,
            master=scheme.User.model_validate(current_user),
            players=[],
            campaign_id=campaign.id,
        )

    try:
        return await campaign_service.create_campaign_session(
            db,
            campaign=campaign,
            lobby=lobby,
            step_index=payload.step_index,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{campaign_id}/continue", response_model=scheme.SessionRedirect)
async def continue_campaign(
    campaign_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    campaign = await campaign_service._load_campaign(db, campaign_id)
    if not campaign or campaign.master_id != current_user.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.carryover_state:
        raise HTTPException(status_code=400, detail="No carryover saved yet")

    links = sorted(campaign.scenario_links or [], key=lambda x: x.order_num)
    step = campaign.current_step_index
    if step >= len(links):
        raise HTTPException(status_code=400, detail="Campaign has no next scenario")

    user_ids_raw = campaign.carryover_state.get("player_user_ids") or []
    user_ids = [UUID(str(x)) for x in user_ids_raw]
    users: list[models.User] = []
    if user_ids:
        users = list(
            (await db.execute(select(models.User).where(models.User.id.in_(user_ids)))).scalars().all()
        )

    players: list[scheme.Player] = []
    carryover = campaign.carryover_state
    for user in users:
        char_id = _character_id_from_carryover(carryover, user.id)
        players.append(
            scheme.Player(
                id=uuid.uuid4(),
                user=scheme.User.model_validate(user),
                name=user.full_name or "Игрок",
                color="#ffffff",
                is_ready=True,
                character_id=char_id,
            )
        )

    lobby = scheme.Lobby(
        id=UUID(int=0),
        name=f"{campaign.name} — шаг {step + 1}",
        max_players=8,
        master=scheme.User.model_validate(current_user),
        players=players,
        campaign_id=campaign.id,
    )

    try:
        return await campaign_service.create_campaign_session(
            db,
            campaign=campaign,
            lobby=lobby,
            step_index=step,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
