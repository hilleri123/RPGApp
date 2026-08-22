from sqlalchemy import Column, String, Boolean, ForeignKey, Uuid, DateTime, Text, Enum
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime, timezone

from app.infrastructure.database import Base


class TodoElementType(str, enum.Enum):
    location        = "location"
    scene           = "scene"
    npc             = "npc"
    item            = "item"
    story_beat      = "story_beat"
    scene_exposure  = "scene_exposure"
    character       = "character"
    map_polygon     = "map_polygon"
    audio_track     = "audio_track"
    scenario        = "scenario"   # общее, не привязанное к конкретному элементу
    other           = "other"


class TodoPriority(str, enum.Enum):
    low    = "low"
    medium = "medium"
    high   = "high"


class ScenarioTodo(Base):
    __tablename__ = "scenario_todo"

    id          = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("scenario_todo.id", ondelete="SET NULL"), nullable=True, index=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True)

    # К чему относится
    element_type = Column(Enum(TodoElementType), nullable=False, default=TodoElementType.other)
    element_id   = Column(Uuid, nullable=True)   # UUID конкретного NPC / локации / сцены и т.д.
    element_name = Column(String, nullable=True) # денормализованное имя — чтоб не джойнить при показе

    # Содержимое
    text     = Column(Text, nullable=False)
    note     = Column(Text, nullable=True)        # расширенный комментарий
    priority = Column(Enum(TodoPriority), nullable=False, default=TodoPriority.medium)

    # Состояние
    is_done    = Column(Boolean, default=False, nullable=False)
    done_at    = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True),
                        default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc),
                        nullable=False)

    # Отношения
    scenario = relationship("Scenario", back_populates="todos")