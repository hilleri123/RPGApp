from __future__ import annotations

from typing import Literal

from .characters import *
from .items import *
from .playbook import *

# Можно держать отдельно, если у тебя в движке принято импортить EntityKind из .types
EntityKind = Literal["character", "npc", "item", "location", "obstacle"]
