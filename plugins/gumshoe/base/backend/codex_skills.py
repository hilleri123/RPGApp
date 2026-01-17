from __future__ import annotations
from pydantic import BaseModel

class SkillGroup(BaseModel):
    id: str
    title: str
    color: str  # например "#22c55e"

class Skill(BaseModel):
    id: str
    title: str
    group: str

class SkillsCodex:
    def __init__(self) -> None:
        self.groups = [
            SkillGroup(id="general", title="General", color="#60a5fa"),  # blue-400
            SkillGroup(id="combat", title="Combat", color="#f97316"),   # orange-500
        ]
        self.skills = [
            Skill(id="athletics", title="Athletics", group="general", min=0, max=5),
            Skill(id="investigation", title="Investigation", group="general", min=0, max=5),
            Skill(id="shooting", title="Shooting", group="combat", min=0, max=5),
        ]

    def as_config(self) -> dict:
        return {
            "skillGroups": [g.model_dump() if hasattr(g, "model_dump") else g.dict() for g in self.groups],
            "skills": [s.model_dump() if hasattr(s, "model_dump") else s.dict() for s in self.skills],
        }
