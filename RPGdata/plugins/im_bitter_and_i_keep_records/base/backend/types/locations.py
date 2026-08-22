from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, NonNegativeInt, conint, confloat


class LocationData(BaseModel):
    temperatureC: int = 0  # можно расширить потом
    illumination: int = 50
