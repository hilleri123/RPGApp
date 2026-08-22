from __future__ import annotations

from plugins.pbta.base.backend.codex import PbtaMovesCodex as PbtaMovesCodexBase
from plugins.pbta.base.backend.types import DamageModifier, Move, MoveCondition, MoveGrantResource, ResourceModifier
from .move_contexts import ACTION, ACTION_CAMP, ACTION_TRAVEL, ALL_SCENES, CAMP, TRAVEL
from .playbooks import PlaybooksCodex

_ACTION = ACTION
_CAMP = CAMP
_TRAVEL = TRAVEL
_ACTION_CAMP = ACTION_CAMP
_ACTION_TRAVEL = ACTION_TRAVEL


class DwMovesCodex(PbtaMovesCodexBase):
    def __init__(self) -> None:
        self._moves: list[Move] = [
            # ═══ БОЙ И ОПАСНОСТЬ (действие) ═══
            Move(
                id="go_aggro",
                title="Руби и кромсай",
                kind="basic",
                tags=["attack", "melee"],
                available_stats=["str"],
                condition=MoveCondition(requires_context=_ACTION),
                summary="Атака в ближнем бою.",
                trigger="Когда вы атакуете противника в ближнем бою...",
                effect="На 10+: наносите урон и уходите от ответной атаки; можете +1к6 урона, но пропустить ответ.",
                effect_7_9="На 7–9: наносите урон, противник атакует вас.",
                damage_mods=[
                    DamageModifier(on_tier=["any_hit"], target="target", description="Урон по цели"),
                ],
            ),
            Move(
                id="shoot_at",
                title="Дать залп",
                kind="basic",
                tags=["attack", "ranged"],
                available_stats=["dex"],
                condition=MoveCondition(requires_context=_ACTION),
                summary="Стрельба на расстоянии.",
                trigger="Когда, находясь на расстоянии, вы целитесь и стреляете...",
                effect="На 10+: точный выстрел, обычный урон.",
                effect_7_9="На 7–9: урон и выберите одно — опасная позиция, −1к6 урона или −1 боезапас.",
                damage_mods=[
                    DamageModifier(on_tier=["any_hit"], target="target", description="Урон оружия"),
                ],
            ),
            Move(
                id="defend",
                title="Встать на защиту",
                kind="basic",
                tags=["defense"],
                available_stats=["con"],
                condition=MoveCondition(requires_context=_ACTION),
                summary="Защита себя или союзника.",
                trigger="Когда вы защищаете от нападения кого-то или что-то...",
                effect="На 10+: запас 3. На 7–9: запас 1. Тратьте запас на заслон, половину урона, открыть врага или контрудар.",
                effect_7_9="На 7–9: запас 1.",
                resource_mods=[],
                grant_resources=[],
            ),
            Move(
                id="act_under_fire",
                title="Спастись от угрозы",
                kind="basic",
                tags=["action"],
                available_stats=["str", "dex", "con", "int", "wis", "cha"],
                condition=MoveCondition(requires_context=_ACTION),
                summary="Действие под угрозой — выберите стат по способу решения.",
                trigger="Когда вы действуете, невзирая на опасность...",
                effect="На 10+: задуманное удаётся, опасности избегаете.",
                effect_7_9="На 7–9: спотыкаетесь — ведущий предложит исход похуже, сделку или выбор.",
            ),
            Move(
                id="evade",
                title="Уйти с линии",
                kind="basic",
                tags=["action"],
                available_stats=["dex"],
                condition=MoveCondition(requires_context=_ACTION),
                summary="Уклонение и отступление в бою.",
                trigger="Когда вы уходите от удара или преследования в бою...",
                effect="На 10+: уходите чисто.",
                effect_7_9="На 7–9: уходите, но теряете позицию, время или что-то важное.",
            ),
            # ═══ СОЦИАЛЬНОЕ И РАЗВЕДКА ═══
            Move(
                id="manipulate",
                title="Договориться",
                kind="basic",
                tags=["social"],
                available_stats=["cha"],
                condition=MoveCondition(requires_context=_ACTION_CAMP),
                summary="Убеждение и манипуляция словами.",
                trigger="Когда вы пытаетесь повлиять на персонажа ведущего...",
                effect="На 10+: просят обещание и помогают.",
                effect_7_9="На 7–9: нужны гарантии, что обещание будет исполнено.",
            ),
            Move(
                id="read_situation",
                title="Изучить обстановку",
                kind="basic",
                tags=["action"],
                available_stats=["wis"],
                condition=MoveCondition(requires_context=_ACTION),
                summary="Внимательный осмотр ситуации.",
                trigger="Когда вы внимательно изучаете человека или ситуацию...",
                effect="На 10+: три вопроса из списка. На 7–9: один вопрос и +1 к следующему ходу с этими сведениями.",
                effect_7_9="На 7–9: один вопрос из списка.",
            ),
            Move(
                id="spout_lore",
                title="Покопаться в памяти",
                kind="basic",
                tags=["action"],
                available_stats=["int"],
                condition=MoveCondition(requires_context=_ACTION_TRAVEL),
                summary="Вспомнить полезные сведения.",
                trigger="Когда вы ищете в памяти сведения о чём-либо...",
                effect="На 10+: ведущий сообщает полезное о текущей ситуации.",
                effect_7_9="На 7–9: что-то интересное, но как извлечь пользу — ваша проблема.",
            ),
            Move(
                id="help_or_hinder",
                title="Помочь или помешать",
                kind="basic",
                tags=["help"],
                available_stats=["cha"],
                condition=MoveCondition(requires_context=ALL_SCENES),
                summary="Помощь или помеха союзнику/врагу по узам.",
                trigger="Когда вы помогаете или мешаете кому-то, с кем у вас узы...",
                effect="На 10+: +1 или −2 к броску. На 7–9: то же, но вы в опасности или платите цену.",
                effect_7_9="На 7–9: эффект есть, но есть отпор или цена.",
            ),
            Move(
                id="last_breath",
                title="Последний вздох",
                kind="basic",
                tags=["special"],
                available_stats=[],
                summary="На грани смерти.",
                trigger="Когда вы умираете...",
                effect="Бросок без бонусов. 10+: живы. 7–9: сделка со Смертью. 6−: судьба предрешена.",
            ),
            # ═══ ЛАГЕРЬ ═══
            Move(
                id="make_camp",
                title="Разбить лагерь",
                kind="basic",
                tags=["camp"],
                condition=MoveCondition(requires_context=_CAMP),
                summary="Привал: паёк, дозор, лечение, повышение уровня.",
                trigger="Когда вы устраиваете привал, потратьте паёк...",
                effect="В опасном месте — договоритесь о дозоре. Сон: лечение половины ОЗ.",
            ),
            Move(
                id="keep_watch",
                title="Нести дозор",
                kind="basic",
                tags=["camp"],
                available_stats=["wis"],
                condition=MoveCondition(requires_context=_CAMP),
                summary="Дозор в лагере.",
                trigger="Когда вы несёте дозор и нечто приближается к лагерю...",
                effect="На 10+: разбудить товарищей, все +1 к следующему ходу. 7–9: поздно, без подготовки. 6−: застали врасплох.",
            ),
            Move(
                id="practice",
                title="Усердно заниматься",
                kind="basic",
                tags=["camp"],
                condition=MoveCondition(requires_context=_CAMP),
                summary="Тренировка и подготовка.",
                trigger="Когда вы тратите время на учёбу, медитацию или тренировки...",
                effect="Получаете очки подготовки (1 за 1–2 недели, 3 за месяц+). Тратьте +1 к релевантному броску.",
            ),
            Move(
                id="resupply",
                title="Пополнить припасы",
                kind="basic",
                tags=["camp"],
                available_stats=["cha"],
                condition=MoveCondition(requires_context=_CAMP),
                summary="Покупки в поселении.",
                trigger="Когда вы тратите наличность на припасы...",
                effect="На 10+: находите нужное по приемлемой цене. 7–9: дороже или похожее, но не то.",
            ),
            Move(
                id="recover",
                title="Восстановить силы",
                kind="basic",
                tags=["camp"],
                condition=MoveCondition(requires_context=_CAMP),
                summary="Отдых в безопасности.",
                trigger="Когда вы отдыхаете со всеми удобствами в безопасном месте...",
                effect="За день — все ОЗ. За три дня — одна травма. С целителем — травма за два дня.",
            ),
            Move(
                id="carouse",
                title="Пирушка",
                kind="basic",
                tags=["camp", "social"],
                available_stats=["cha"],
                condition=MoveCondition(requires_context=_CAMP),
                summary="Празднование победы.",
                trigger="Когда вы устраиваете большую гулянку после победы (100+ монет)...",
                effect="На 10+: три пункта из списка. 7–9: один. 6−: один, но что-то идёт наперекосяк.",
            ),
            Move(
                id="recruit",
                title="Найм",
                kind="basic",
                tags=["social"],
                available_stats=["cha"],
                condition=MoveCondition(requires_context=_CAMP),
                summary="Найм наёмников.",
                trigger="Когда вы хотите обзавестись наёмниками...",
                effect="Бонусы за щедрость, честность, долю добычи, репутацию. 10+: выбор кандидатов. 7–9: компромисс.",
            ),
            # ═══ ПУТЕШЕСТВИЕ ═══
            Move(
                id="undertake_journey",
                title="Отправиться в опасное путешествие",
                kind="basic",
                tags=["travel"],
                available_stats=["wis"],
                condition=MoveCondition(requires_context=_TRAVEL),
                summary="Путь по враждебным землям — проводник, разведчик, интендант.",
                trigger="Когда вы держите путь по враждебным территориям...",
                effect="На 10+: интендант −1 паёк, проводник сокращает путь, разведчик видит опасность. 7–9: как ожидалось.",
            ),
        ]
        self._moves += list(PlaybooksCodex().moves_map().values())

    def get_moves(self) -> list[Move]:
        return self._moves


MovesCodex = DwMovesCodex
