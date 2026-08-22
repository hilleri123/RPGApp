from sqlalchemy.types import TypeDecorator, String
from pydantic import BaseModel, HttpUrl, ValidationError

class ValidatedURL(TypeDecorator):
    impl = String

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, str) and value.strip() == "":
            return None
        class Model(BaseModel):
            url: HttpUrl
        try:
            Model(url=value)
        except ValidationError as e:
            raise ValueError(f"Invalid URL: {e}")
        return value