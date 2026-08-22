from __future__ import annotations

from ....base.backend.codex import SkillsCodex as BaseSkillsCodex
from ..types import *


class SkillsCodex(BaseSkillsCodex):
    def __init__(self) -> None:
        self.groups: list[SkillGroup] = [
            SkillGroup(id="investigative_academic",      title="Исследование: научное",        color="#22c55e", kind="investigative"),
            SkillGroup(id="investigative_interpersonal", title="Исследование: межличностное",   color="#f700ff", kind="investigative"),
            SkillGroup(id="investigative_technical",     title="Исследование: прикладное",      color="#3e00fa", kind="investigative"),
            SkillGroup(id="general_action",              title="Общие способности",             color="#f71b1b", kind="general"),
        ]

        self.skills: list[Skill] = [
            # --- Исследовательские: научные ---
            Skill(id="anthropology",         title="Антропология",          group="investigative_academic"),
            Skill(id="archaeology",          title="Археология",            group="investigative_academic"),
            Skill(id="architecture",         title="Архитектура",           group="investigative_academic"),
            Skill(id="biology",              title="Биология",              group="investigative_academic"),
            Skill(id="accounting",           title="Бухгалтерское дело",    group="investigative_academic"),
            Skill(id="geology",              title="Геология",              group="investigative_academic"),
            Skill(id="natural_science",      title="Естествознание",        group="investigative_academic"),
            Skill(id="history",              title="История",               group="investigative_academic"),
            Skill(id="art_history",          title="История искусств",      group="investigative_academic"),
            Skill(id="library_use",          title="Книжные изыскания",     group="investigative_academic"),
            Skill(id="cryptography",         title="Криптография",          group="investigative_academic"),
            Skill(id="medicine",             title="Медицина",              group="investigative_academic"),
            Skill(id="cthulhu_mythos",       title="Мифология Ктулху",      group="investigative_academic"),
            Skill(id="occult",               title="Оккультизм",            group="investigative_academic"),
            Skill(id="theology",             title="Теология",              group="investigative_academic"),
            Skill(id="physics",              title="Физика",                group="investigative_academic"),
            Skill(id="jurisprudence",        title="Юриспруденция",         group="investigative_academic"),
            Skill(id="languages",            title="Языки",                 group="investigative_academic"),

            # --- Исследовательские: межличностные ---
            Skill(id="bureaucracy",          title="Бюрократия",            group="investigative_interpersonal"),
            Skill(id="interrogation",        title="Допрос",                group="investigative_interpersonal"),
            Skill(id="intimidation",         title="Запугивание",           group="investigative_interpersonal"),
            Skill(id="oral_history",         title="Изустная история",      group="investigative_interpersonal"),
            Skill(id="flattery",             title="Лесть",                 group="investigative_interpersonal"),
            Skill(id="police_jargon",        title="Полицейский жаргон",    group="investigative_interpersonal"),
            Skill(id="insight",              title="Проницательность",      group="investigative_interpersonal"),
            Skill(id="status",               title="Статус",                group="investigative_interpersonal"),
            Skill(id="trade",                title="Торговля",              group="investigative_interpersonal"),
            Skill(id="streetwise",           title="Уличное чутьё",         group="investigative_interpersonal"),
            Skill(id="reassurance",          title="Успокаивание",          group="investigative_interpersonal"),

            # --- Исследовательские: прикладные ---
            Skill(id="lockpicking",          title="Взлом",                 group="investigative_technical"),
            Skill(id="art",                  title="Искусство",             group="investigative_technical"),
            Skill(id="craft",                title="Ремесло",               group="investigative_technical"),
            Skill(id="evidence_collection",  title="Сбор улик",             group="investigative_technical"),
            Skill(id="forensic_medicine",    title="Судмедэкспертиза",      group="investigative_technical"),
            Skill(id="pharmacy",             title="Фармацевтика",          group="investigative_technical"),
            Skill(id="photography",          title="Фотография",            group="investigative_technical"),
            Skill(id="chemistry",            title="Химия",                 group="investigative_technical"),
            Skill(id="astronomy",            title="Астрономия",            group="investigative_technical"),

            # --- Общие ---
            Skill(id="athletics",            title="Атлетика",              group="general_action"),
            Skill(id="fleeing",              title="Бегство",               group="general_action"),
            Skill(id="alertness",            title="Бдительность",          group="general_action"),
            Skill(id="riding",               title="Верховая езда",         group="general_action"),
            Skill(id="demolition",           title="Взрывотехника",         group="general_action"),
            Skill(id="driving",              title="Вождение",              group="general_action"),
            Skill(id="theft",                title="Воровство",             group="general_action"),
            Skill(id="hypnosis",             title="Гипноз",                group="general_action"),
            Skill(id="scuffling",            title="Драка",                 group="general_action"),
            Skill(id="health",               title="Здоровье",              group="general_action"),
            Skill(id="disguise",             title="Маскировка",            group="general_action"),
            Skill(id="mechanics",            title="Механика",              group="general_action"),
            Skill(id="first_aid",            title="Первая помощь",         group="general_action"),
            Skill(id="piloting",             title="Пилотирование",         group="general_action"),
            Skill(id="foresight",            title="Предусмотрительность",  group="general_action"),
            Skill(id="deception",            title="Притворство",           group="general_action"),
            Skill(id="psychoanalysis",       title="Психоанализ",           group="general_action"),
            Skill(id="sanity",               title="Рассудок",              group="general_action"),
            Skill(id="stability",            title="Самообладание",         group="general_action"),
            Skill(id="stealth",              title="Скрытность",            group="general_action"),
            Skill(id="surveillance",         title="Слежка",                group="general_action"),
            Skill(id="shooting",             title="Стрельба",              group="general_action"),
            Skill(id="fencing",              title="Фехтование",            group="general_action"),
            Skill(id="electrical_repair",    title="Электротехника",        group="general_action"),
        ]

    def attack_skill(self, wt: WeaponType) -> Skill:
        skill_id = "scuffling"
        if wt == "melee":
            # skill_id = "fencing"
            skill_id = "scuffling"
        if wt == "ranged":
            skill_id = "shooting"
        return self.allowed_map().get(skill_id, None)