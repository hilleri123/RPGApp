from .investigate_obstacle import InvestigateObstacleWorkflow
from .attack import AttackWorkflow
from .contest import ContestWorkflow
from .terrify import TerrifyWorkflow
from .npc_dialog import NpcDialogWorkflow

workflows = [
    AttackWorkflow, 
    ContestWorkflow, 
    InvestigateObstacleWorkflow, 
    NpcDialogWorkflow,
    TerrifyWorkflow,
]