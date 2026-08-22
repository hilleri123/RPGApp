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
            SkillGroup(id="general_action", title="Общие: действие", color="#f71b1b", kind="general"),
        ]

        self.skills: list[Skill] = [
            # --- Исследовательские: академические (Научные) ---
            Skill(id="text_analysis", title="Анализ текста", group="investigative_academic"),
            Skill(id="anthropology", title="Антропология", group="investigative_academic"),
            Skill(id="archaeology", title="Археология", group="investigative_academic"),
            Skill(id="architecture", title="Архитектура", group="investigative_academic"),
            Skill(id="audit", title="Аудит", group="investigative_academic"),
            Skill(id="natural_science", title="Естествознание", group="investigative_academic"),
            Skill(id="languages", title="Знание языков", group="investigative_academic"),
            Skill(id="applied_physics", title="Прикладная физика", group="investigative_academic"),
            Skill(id="art_history", title="Искусствоведение", group="investigative_academic"),
            Skill(id="research", title="Исследовательская работа", group="investigative_academic"),
            Skill(id="history", title="История", group="investigative_academic"),
            Skill(id="linguistics", title="Лингвистика", group="investigative_academic"),
            Skill(id="occult", title="Оккультные науки", group="investigative_academic"),
            Skill(id="forensic_psychology", title="Судебная психология", group="investigative_academic"),
            Skill(id="jurisprudence", title="Юриспруденция", group="investigative_academic"),
            Skill(id="erudition", title="Эрудиция", group="investigative_academic"),

            # --- Исследовательские: социальные (Межличностные) ---
            Skill(id="bureaucracy", title="Бюрократия", group="investigative_interpersonal"),
            Skill(id="intimidation", title="Запугивание", group="investigative_interpersonal"),
            Skill(id="interrogation", title="Ведение допроса", group="investigative_interpersonal"),
            Skill(id="negotiation", title="Ведение переговоров", group="investigative_interpersonal"),
            Skill(id="flattery", title="Лесть", group="investigative_interpersonal"),
            Skill(id="police_jargon", title="Полицейский жаргон", group="investigative_interpersonal"),
            Skill(id="deception", title="Притворство", group="investigative_interpersonal"),
            Skill(id="insight", title="Проницательность", group="investigative_interpersonal"),
            Skill(id="streetwise", title="Уличное чутьё", group="investigative_interpersonal"),
            Skill(id="reassurance", title="Успокаивание", group="investigative_interpersonal"),
            Skill(id="flirt", title="Флирт", group="investigative_interpersonal"),

            # --- Исследовательские: технические (Технические) ---
            Skill(id="document_analysis", title="Анализ документов", group="investigative_technical"),
            Skill(id="astronomy", title="Астрономия", group="investigative_technical"),
            Skill(id="ballistics", title="Баллистика", group="investigative_technical"),
            Skill(id="dactyloscopy", title="Дактилоскопия", group="investigative_technical"),
            Skill(id="data_extraction", title="Извлечение данных", group="investigative_technical"),
            Skill(id="cryptography", title="Криптография", group="investigative_technical"),
            Skill(id="pathology", title="Патология", group="investigative_technical"),
            Skill(id="applied_physics", title="Прикладная физика", group="investigative_technical"),
            Skill(id="demolition", title="Сапёрное дело", group="investigative_technical"),
            Skill(id="evidence_collection", title="Сбор улик", group="investigative_technical"),
            Skill(id="forensic_anthropology", title="Судебная антропология", group="investigative_technical"),
            Skill(id="photography", title="Фотография", group="investigative_technical"),
            Skill(id="chemistry", title="Химия", group="investigative_technical"),
            Skill(id="electronic_surveillance", title="Электронная слежка", group="investigative_technical"),

            # --- Общие (Общие) ---
            Skill(id="athletics", title="Атлетика", group="general_action"),
            Skill(id="driving", title="Вождение", group="general_action"),
            Skill(id="theft", title="Воровство", group="general_action"),
            Skill(id="scuffling", title="Драка", group="general_action"),
            Skill(id="health", title="Здоровье", group="general_action"),
            Skill(id="mechanics", title="Механика", group="general_action"),
            Skill(id="inspiration", title="Ободрение", group="general_action"),
            Skill(id="first_aid", title="Первая помощь", group="general_action"),
            Skill(id="foresight", title="Предусмотрительность", group="general_action"),
            Skill(id="infiltration", title="Проникновение", group="general_action"),
            Skill(id="stability", title="Самообладание", group="general_action"),
            Skill(id="surveillance", title="Слежка", group="general_action"),
            Skill(id="shooting", title="Стрельба", group="general_action"),
        ]


    def attack_skill(self, wt: WeaponType) -> Skill:
        skill_id = "scuffling"
        if wt == "melee":
            skill_id = "scuffling"
        if wt == "ranged":
            skill_id = "shooting"
        return self.allowed_map().get(skill_id, None)


