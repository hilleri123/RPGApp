
from typing import List, Literal, Optional, Union
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID


class Settings(BaseModel):
    show_action_to_everyone: bool = False
    merge_scenes_for_players: bool = True
    audio_mode: Literal["local", "observer"] = "local"
    hide_audio_name: bool = True
    allow_character_swap: bool = False
    edit_scenario: bool = False
    master_filter_tags: list[str] = Field(default_factory=list)

