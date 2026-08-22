from __future__ import annotations
from typing import Literal

from pydantic import BaseModel, ConfigDict, PositiveInt
from ....base.backend.codex import SkillsCodex as BaseSkillsCodex
from ..types import *

class SkillsCodex(BaseSkillsCodex):
    def __init__(self) -> None:
        self.groups: list[SkillGroup] = [
            SkillGroup(id="investigative_academic", title="Исследование: академическое", color="#22c55e", kind="investigative"),
            SkillGroup(id="investigative_interpersonal", title="Исследование: социальное", color="#f700ff", kind="investigative"),
            SkillGroup(id="investigative_technical", title="Исследование: техническое", color="#3e00fa", kind="investigative"),
            SkillGroup(id="investigative_action", title="Исследование: действия", color="#ffee00", kind="both"),
            SkillGroup(id="general_status", title="Общие: статус", color="#ff7b00", kind="general"),
            SkillGroup(id="general_fight", title="Общие: драка", color="#ff0000", kind="general"),
        ]

        self.skills: list[Skill] = [
            # --- Исследовательские: академические (Научные) ---
            Skill(id="architecture", title="Архитектура", group="investigative_academic"),
            Skill(id="languages", title="Знание языков", group="investigative_academic"),
            Skill(id="jurisprudence", title="Юриспруденция", group="investigative_academic"),
            Skill(id="erudition", title="Эрудиция", group="investigative_academic"),

            # --- Исследовательские: социальные (Межличностные) ---
            Skill(id="bureaucracy", title="Бюрократия", group="investigative_interpersonal"),
            Skill(id="intimidation", title="Запугивание", group="investigative_interpersonal"),
            Skill(id="negotiation", title="Ведение переговоров", group="investigative_interpersonal"),
            Skill(id="flattery", title="Лесть", group="investigative_interpersonal"),
            Skill(id="police_jargon", title="Полицейский жаргон", group="investigative_interpersonal"),
            Skill(id="deception", title="Притворство", group="investigative_interpersonal"),
            Skill(id="insight", title="Проницательность", group="investigative_interpersonal"),
            Skill(id="reassurance", title="Успокаивание", group="investigative_interpersonal"),
            Skill(id="flirt", title="Флирт", group="investigative_interpersonal"),

            # --- Исследовательские: технические (Технические) ---
            Skill(id="document_analysis", title="Анализ документов", group="investigative_technical"),
            Skill(id="data_extraction", title="Извлечение данных", group="investigative_technical"),
            Skill(id="pathology", title="Патология", group="investigative_technical"),
            Skill(id="demolition", title="Сапёрное дело", group="investigative_technical"),
            Skill(id="evidence_collection", title="Сбор улик", group="investigative_technical"),
            Skill(id="chemistry", title="Химия", group="investigative_technical"),
            
            # --- Общие (Общие) ---
            Skill(id="athletics", title="Атлетика", group="investigative_action"),
            Skill(id="driving", title="Вождение", group="investigative_action"),
            Skill(id="theft", title="Воровство", group="investigative_action"),
            Skill(id="mechanics", title="Механика", group="investigative_action"),
            Skill(id="first_aid", title="Первая помощь", group="investigative_action"),
            Skill(id="foresight", title="Предусмотрительность", group="investigative_action"),


            Skill(id="health", title="Здоровье", group="general_status"),
            Skill(id="stability", title="Самообладание", group="general_status"),


            Skill(id="shooting", title="Стрельба", group="general_fight"),
            Skill(id="scuffling", title="Драка", group="general_fight"),
        ]


    def attack_skill(self, wt: WeaponType) -> Skill:
        skill_id = "scuffling"
        if wt == "melee":
            skill_id = "scuffling"
        if wt == "ranged":
            skill_id = "shooting"
        return self.allowed_map().get(skill_id, None)


