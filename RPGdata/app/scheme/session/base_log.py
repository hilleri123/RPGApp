from typing import Optional, List, Literal, Dict, Any, Type, Union, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from .base_actions import get_all_subclasses
from app.logger import logger


class LogMsgBase(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    dt: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: UUID
    log_type: str


    @staticmethod
    def parse_action(data: Dict[str, Any]):
        # Получаем ВСЕ классы-наследники SessionActionBase
        action_classes = get_all_subclasses(LogMsgBase)
        
        for cls in action_classes:
            # Проверяем наличие обязательных атрибутов
            type_hints = get_type_hints(cls)
            cls_log_type = type_hints.get('log_type', None)
            if cls_log_type and get_origin(cls_log_type) is Literal:
                cls_log_type = cls_log_type.__args__[0]

            # Проверяем соответствие user_role и msg_type
            if (cls_log_type == data.get('msg_type')):
                try:
                    return cls(**data)
                except ValidationError as e:
                    raise ValueError(f"Validation error for {cls.__name__}: {e}")
        
        raise ValueError("No matching action class found")
    


