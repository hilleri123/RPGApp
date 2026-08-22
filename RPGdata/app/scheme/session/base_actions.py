from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime, timezone
from uuid import UUID


from app.logger import logger



def get_all_subclasses(cls) -> List[Type]:
    """Рекурсивно собирает все подклассы"""
    subclasses = []
    for subclass in cls.__subclasses__():
        subclasses.append(subclass)
        subclasses.extend(get_all_subclasses(subclass))
    return subclasses


class SessionActionBase(BaseModel):
    user_id: Optional[UUID] = None
    user_role: str
    msg_type: str
    created_at: Optional[datetime] = datetime.now(timezone.utc)

    @staticmethod
    def parse_action(data: Dict[str, Any]):
        # Получаем ВСЕ классы-наследники SessionActionBase
        action_classes = get_all_subclasses(SessionActionBase)
        
        for cls in action_classes:
            # Проверяем наличие обязательных атрибутов
            type_hints = get_type_hints(cls)
            cls_user_role = type_hints.get('user_role', None)
            if cls_user_role and get_origin(cls_user_role) is Literal:
                cls_user_role = cls_user_role.__args__[0]
            cls_msg_type = type_hints.get('msg_type', None)
            if cls_msg_type and get_origin(cls_msg_type) is Literal:
                cls_msg_type = cls_msg_type.__args__[0]

            # Проверяем соответствие user_role и msg_type
            if (cls_user_role == data.get('user_role') and
                cls_msg_type == data.get('msg_type')):
                try:
                    return cls(**data)
                except ValidationError as e:
                    raise ValueError(f"Validation error for {cls.__name__}: {e}")
        
        raise ValueError("No matching action class found")
    

class MasterSessionActionBase(SessionActionBase):
    user_role: Literal['master'] = 'master'



class PlayerSessionActionBase(SessionActionBase):
    user_role: Literal['player'] = 'player'



