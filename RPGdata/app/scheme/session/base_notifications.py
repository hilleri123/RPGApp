from typing import Optional, List, Literal, Dict, Any, Type, Union, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from .base_actions import get_all_subclasses
from app.logger import logger


class NotificationBase(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    dt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notif_type: str
    initiator_id: UUID
    recipients: list[UUID]
    readed_by: list[UUID] = Field(default_factory=list)

    class Config:
        from_attributes = True

    @staticmethod
    def parse_notification(data: Dict[str, Any]) -> "NotificationBase":
        """
        Фабрика: ищет подходящий класс-наследник по notif_type (Literal в наследнике).
        Если подходящий класс не найден — вернёт базовый NotificationBase.
        """
        target_type = data.get("notif_type")
        if not target_type:
            # если notif_type не указан — валидируем базовой моделью (или кидаем ошибку)
            return NotificationBase(**data)

        # Получаем все подклассы NotificationBase
        notif_classes = get_all_subclasses(NotificationBase)

        for cls in notif_classes:
            # Ищем в type hints поле notif_type с Literal
            type_hints = get_type_hints(cls)
            cls_notif_type = type_hints.get("notif_type")
            if cls_notif_type and get_origin(cls_notif_type) is Literal:
                # Literal['value'] -> достаём 'value'
                cls_notif_type_val = cls_notif_type.__args__[0]
                if cls_notif_type_val == target_type:
                    try:
                        return cls(**data)
                    except ValidationError as e:
                        raise ValueError(f"Validation error for {cls.__name__}: {e}") from e

        # Если не нашли наследника — вернём базовую модель
        return NotificationBase(**data)


