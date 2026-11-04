from typing import Literal

from ..base_actions import PlayerSessionActionBase


class PlayerSceneCue(PlayerSessionActionBase):
    msg_type: Literal['scene_cue'] = 'scene_cue'
    kind: Literal['hand', 'up', 'down']
