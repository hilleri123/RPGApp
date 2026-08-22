from typing import Literal

from ..base_actions import MasterSessionActionBase


class SetSessionTime(MasterSessionActionBase):
    msg_type: Literal['set_session_time'] = 'set_session_time'
    time: str
