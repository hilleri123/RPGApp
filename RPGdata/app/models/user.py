from sqlalchemy import UUID, BigInteger, Boolean, Column, Uuid, ForeignKey, String, JSON
from sqlalchemy.orm import relationship
import uuid

from .validators import ValidatedURL
from app.infrastructure.database import Base

class User(Base):
    __tablename__ = "user"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True)
    tg = Column(String, unique=True)
    telegram_id = Column(BigInteger, unique=True, index=True)
    is_admin = Column(Boolean, default=False)
    can_be_master = Column(Boolean, default= False)
    full_name = Column(String)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

    icon_url = Column(ValidatedURL(256))
    img_url = Column(ValidatedURL(256))

    # Отношения
    scenarios = relationship("Scenario", back_populates="user")
    player_characters = relationship("Player", back_populates="user")
    game_sessions = relationship("GameSession", back_populates="master")
    campaigns = relationship("Campaign", back_populates="master")
    master_groups = relationship("MasterGroup", secondary="user_master_group", overlaps="user_master_groups", back_populates="users")
    user_master_groups = relationship("UserMasterGroup", overlaps="master_groups", back_populates="user")

    character_applications = relationship(
        "CharacterApplication",
        back_populates="user",
        cascade="all, delete-orphan",
    )

#-------------------------------------------

class MasterGroup(Base):
    __tablename__ = "master_group"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)

    # Отношения
    users = relationship("User", secondary="user_master_group", overlaps="user_master_groups", back_populates="master_groups")
    user_master_groups = relationship("UserMasterGroup", overlaps="users,master_groups", back_populates="master_group")
    scenario_accesses = relationship("MasterGroupScenarioAccess", back_populates="master_group")


class UserMasterGroup(Base):
    __tablename__ = "user_master_group"

    user_id = Column(Uuid, ForeignKey("user.id"), primary_key=True)
    master_group_id = Column(Uuid, ForeignKey("master_group.id"), primary_key=True)
    permission = Column(String, nullable=False)  # read / edit_partial / edit_full / all

    # Отношения
    user = relationship("User", overlaps="master_groups,users", back_populates="user_master_groups")
    master_group = relationship("MasterGroup", overlaps="users,master_groups", back_populates="user_master_groups")


#-------------------------------------------


class MasterGroupScenarioAccess(Base):
    __tablename__ = "master_group_scenario_access"

    master_group_id = Column(Uuid, ForeignKey("master_group.id"), primary_key=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id"), primary_key=True)
    permission = Column(String, nullable=False)  # read/edit_partial/edit_full/all

    master_group = relationship("MasterGroup", back_populates="scenario_accesses")
    scenario = relationship("Scenario", back_populates="master_group_accesses")



#-------------------------------------------

class Player(Base):
    __tablename__ = "player"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String)
    color = Column(String)

    icon_url = Column(ValidatedURL(256))
    img_url = Column(ValidatedURL(256))

    user_id = Column(Uuid, ForeignKey("user.id"))
    game_session_id = Column(Uuid, ForeignKey("game_session.id", ondelete="CASCADE"))
    # character_id = Column(Uuid, ForeignKey("player_character.id"))

    finished_with_character_data = Column(JSON, nullable=True)

    character_source_type = Column(String, nullable=True)   # scenario | application | custom
    character_id = Column(UUID(as_uuid=True), nullable=True)
    character_snapshot = Column(JSON, nullable=True)
    
    # Отношения
    user = relationship("User", back_populates="player_characters")
    # character = relationship("PlayerCharacter", back_populates="player") 
    session = relationship("GameSession", back_populates="players")