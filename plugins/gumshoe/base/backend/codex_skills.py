from __future__ import annotations

from pydantic import BaseModel, ConfigDict, PositiveInt


class SkillGroup(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    color: str


class Skill(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    group: str



class SkillsCodex:
    INVESTIGATIVE_GROUPS = {
        "investigative_academic",
        "investigative_interpersonal",
        "investigative_technical",
    }
    GENERAL_GROUPS = {
        "general_action",
        "general_combat",
        "general_survival",
    }

    def __init__(self) -> None:
        self.groups: list[SkillGroup] = [
            SkillGroup(id="investigative_academic", title="Исследование: академическое", color="#22c55e"),
            SkillGroup(id="investigative_interpersonal", title="Исследование: социальное", color="#14b8a6"),
            SkillGroup(id="investigative_technical", title="Исследование: техническое", color="#a78bfa"),
            SkillGroup(id="general_action", title="Общие: действие", color="#60a5fa"),
            SkillGroup(id="general_combat", title="Общие: бой", color="#f97316"),
            SkillGroup(id="general_survival", title="Общие: выживание", color="#f43f5e"),
        ]

        # Набор абилок составлен по списку GUMSHOE SRD (CC v3). [web:3]
        self.skills: list[Skill] = [
            # --- Исследовательские: академические ---
            Skill(id="anthropology", title="Антропология", group="investigative_academic"),
            Skill(id="archaeology", title="Археология", group="investigative_academic"),
            Skill(id="architecture", title="Архитектура", group="investigative_academic"),
            Skill(id="art_history", title="История искусства", group="investigative_academic"),
            Skill(id="belle_lettres", title="Изящная словесность", group="investigative_academic"),
            Skill(id="botany", title="Ботаника", group="investigative_academic"),
            Skill(id="comparative_religion", title="Сравнительное религиоведение", group="investigative_academic"),
            Skill(id="culture", title="Культура", group="investigative_academic"),
            Skill(id="fashion", title="Мода", group="investigative_academic"),
            Skill(id="forensic_accounting", title="Судебная бухгалтерия", group="investigative_academic"),
            Skill(id="forensic_psychology", title="Судебная психология", group="investigative_academic"),
            Skill(id="geology", title="Геология", group="investigative_academic"),
            Skill(id="languages", title="Языки", group="investigative_academic"),
            Skill(id="linguistics", title="Лингвистика", group="investigative_academic"),
            Skill(id="military_history", title="Военная история", group="investigative_academic"),
            Skill(id="natural_history", title="Естественная история", group="investigative_academic"),
            Skill(id="occult", title="Оккультизм", group="investigative_academic"),
            Skill(id="oral_history", title="Устная история", group="investigative_academic"),
            Skill(id="poetry", title="Поэзия", group="investigative_academic"),
            Skill(id="political_science", title="Политология", group="investigative_academic"),
            Skill(id="research", title="Работа с источниками", group="investigative_academic"),
            Skill(id="textual_analysis", title="Анализ текста", group="investigative_academic"),

            # --- Исследовательские: социальные ---
            Skill(id="authority", title="Авторитет", group="investigative_interpersonal"),
            Skill(id="bonhomie", title="Обаяние простоты", group="investigative_interpersonal"),
            Skill(id="bullshit_detector", title="Распознавание лжи", group="investigative_interpersonal"),
            Skill(id="bureaucracy", title="Бюрократия", group="investigative_interpersonal"),
            Skill(id="charm", title="Шарм", group="investigative_interpersonal"),
            Skill(id="cop_talk", title="Разговор с копами", group="investigative_interpersonal"),
            Skill(id="flattery", title="Лесть", group="investigative_interpersonal"),
            Skill(id="flirting", title="Флирт", group="investigative_interpersonal"),
            Skill(id="high_society", title="Высший свет", group="investigative_interpersonal"),
            Skill(id="interrogation", title="Допрос", group="investigative_interpersonal"),
            Skill(id="intimidation", title="Запугивание", group="investigative_interpersonal"),
            Skill(id="leadership", title="Лидерство", group="investigative_interpersonal"),
            Skill(id="reassurance", title="Успокоение", group="investigative_interpersonal"),
            Skill(id="respectability", title="Респектабельность", group="investigative_interpersonal"),
            Skill(id="streetwise", title="Знание улиц", group="investigative_interpersonal"),
            Skill(id="taunt", title="Провокация", group="investigative_interpersonal"),

            # --- Исследовательские: технические ---
            Skill(id="astronomy", title="Астрономия", group="investigative_technical"),
            Skill(id="ballistics", title="Баллистика", group="investigative_technical"),
            Skill(id="camping", title="Лагерное дело", group="investigative_technical"),
            Skill(id="chemistry", title="Химия", group="investigative_technical"),
            Skill(id="craft", title="Ремесло", group="investigative_technical"),
            Skill(id="cryptography", title="Криптография", group="investigative_technical"),
            Skill(id="data_retrieval", title="Извлечение данных", group="investigative_technical"),
            Skill(id="document_analysis", title="Анализ документов", group="investigative_technical"),
            Skill(id="electronic_surveillance", title="Электронная слежка", group="investigative_technical"),
            Skill(id="evidence_collection", title="Сбор улик", group="investigative_technical"),
            Skill(id="explosive_devices", title="Взрывные устройства", group="investigative_technical"),
            Skill(id="farming", title="Фермерство", group="investigative_technical"),
            Skill(id="fingerprinting", title="Дактилоскопия", group="investigative_technical"),
            Skill(id="forensic_anthropology", title="Судебная антропология", group="investigative_technical"),
            Skill(id="forensic_entomology", title="Судебная энтомология", group="investigative_technical"),
            Skill(id="forgery", title="Подделка", group="investigative_technical"),
            Skill(id="hacking", title="Взлом", group="investigative_technical"),
            Skill(id="locksmith", title="Вскрытие замков", group="investigative_technical"),
            Skill(id="medical_expertise", title="Медицинская экспертиза", group="investigative_technical"),
            Skill(id="mechanics", title="Механика", group="investigative_technical"),
            Skill(id="pharmacy", title="Фармация", group="investigative_technical"),
            Skill(id="photography", title="Фотография", group="investigative_technical"),
            Skill(id="spying", title="Шпионаж", group="investigative_technical"),
            Skill(id="terrain_analysis", title="Анализ местности", group="investigative_technical"),
            Skill(id="traffic_analysis", title="Анализ трафика", group="investigative_technical"),

            # --- Общие: действие ---
            Skill(id="athletics", title="Атлетика", group="general_action"),
            Skill(id="burglary", title="Взлом и проникновение", group="general_action"),
            Skill(id="disguise", title="Маскировка", group="general_action"),
            Skill(id="driving", title="Вождение", group="general_action"),
            Skill(id="filch", title="Карманничанье", group="general_action"),
            Skill(id="fleeing", title="Побег", group="general_action"),
            Skill(id="infiltration", title="Проникновение", group="general_action"),
            Skill(id="piloting", title="Пилотирование", group="general_action"),
            Skill(id="riding", title="Верховая езда", group="general_action"),
            Skill(id="shadowing", title="Слежка", group="general_action"),
            Skill(id="stealth", title="Скрытность", group="general_action"),
            Skill(id="tinkering", title="Ковыряние в механизмах", group="general_action"),

            # --- Общие: бой ---
            Skill(id="scuffling", title="Рукопашная", group="general_combat"),
            Skill(id="shooting", title="Стрельба", group="general_combat"),
            Skill(id="weapons", title="Холодное оружие", group="general_combat"),

            # --- Общие: выживание ---
            Skill(id="health", title="Здоровье", group="general_survival"),
            Skill(id="stability", title="Стабильность", group="general_survival"),
            Skill(id="preparedness", title="Подготовленность", group="general_survival"),
            Skill(id="sense_trouble", title="Чутьё на неприятности", group="general_survival"),
        ]

    def as_config(self) -> dict:
        return {
            "skillGroups": [g.model_dump() for g in self.groups],
            "skills": [s.model_dump() for s in self.skills],
        }

    def allowed_map(self) -> dict[str, Skill]:
        return {s.id: s for s in self.skills}

    def skill_kind(self, skill_id: str) -> str:
        s = self.allowed_map().get(skill_id)
        if not s:
            return "unknown"
        if s.group in self.INVESTIGATIVE_GROUPS:
            return "investigative"
        if s.group in self.GENERAL_GROUPS:
            return "general"
        return "unknown"