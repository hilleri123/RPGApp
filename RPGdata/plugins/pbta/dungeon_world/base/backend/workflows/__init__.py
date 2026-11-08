from .scene_battle_initiative_roll import *
from .perform_move import *
from .prepare_spells import *
from .level_up import *
from .grant_xp import *
from .issue_changes import IssueChangesWorkflow

workflows = [
    PerformMoveWorkflow,
    IssueChangesWorkflow,
    PrepareSpellsWorkflow,
    LevelUpWorkflow,
    GrantXpWorkflow,
    RollInitiativeWorkflow,
    InitiativeTurnWorkflow,
]
