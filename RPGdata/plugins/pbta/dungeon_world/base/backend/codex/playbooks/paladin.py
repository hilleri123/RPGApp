from __future__ import annotations

from plugins.pbta.base.backend.types import (
    DamageModifier,
    Move,
    MoveCondition,
    MoveGrantResource,
    Playbook,
)
from plugins.pbta.base.backend.types.types_classes import (
    MovePlaceholder,
    MovePlaceholderOption,
)
from ..multiclass_options import MULTICLASS_EFFECT_TEXT, MULTICLASS_MOVE_PLACEHOLDERS

_QUEST_GOAL_OPTIONS = [
    MovePlaceholderOption(
        id="kill",
        label="Убить … — настоящую чуму этих земель",
    ),
    MovePlaceholderOption(
        id="protect",
        label="Защитить … от несправедливости",
    ),
    MovePlaceholderOption(
        id="reveal",
        label="Открыть всю правду о …",
    ),
]

_QUEST_GIFT_OPTIONS = [
    MovePlaceholderOption(
        id="know_direction",
        label="Всегда знать направление к …",
    ),
    MovePlaceholderOption(
        id="immunity",
        label="Неуязвимость к … (клинки, огонь, зачарование и т.п.)",
    ),
    MovePlaceholderOption(
        id="sign_of_power",
        label="Знак того, что вы наделены властью свыше",
    ),
    MovePlaceholderOption(
        id="sense_lies",
        label="Способность чуять ложь",
    ),
    MovePlaceholderOption(
        id="universal_voice",
        label="Голос, для которого нет языковых барьеров",
    ),
    MovePlaceholderOption(
        id="no_sustenance",
        label="Не нуждаетесь в воде, пище и сне",
    ),
]

paladin = Playbook(
    id="paladin",
    title="Паладин",
    archetype="combat",
    summary=(
        "Ты — оружие, рука и взгляд высшей силы. "
        "Твоя клятва реальна, а мир будет мериться с твоей верой."
    ),
    base_hp=10,
    base_load=12,
    damage_die="d10",
    starting_moves=[
        "paladin_lay_on_hands",
        "paladin_armored",
        "paladin_i_am_the_law",
        "paladin_quest",
    ],
    advanced_moves=[
        "paladin_divine_patronage",
        "paladin_bloody_shield",
        "paladin_smite",
        "paladin_exterminatus",
        "paladin_charge",
        "paladin_steadfast_defender",
        "paladin_coordinated_attack",
        "paladin_holy_protection",
        "paladin_armed_with_authority",
        "paladin_hospitaller",
        "paladin_multiclass_dabbler",
    ],
    advanced_moves_6_10=[
        "paladin_mark_of_faith",
        "paladin_holy_strike",
        "paladin_forward_only",
        "paladin_unshakeable_defender",
        "paladin_joint_attack",
        "paladin_divine_armor",
        "paladin_armed_with_authority_supreme",
        "paladin_perfect_hospitaller",
        "paladin_indomitable",
        "paladin_perfect_knight",
    ],
)


paladin_moves: list[Move] = [
    Move(
        id="paladin_lay_on_hands",
        title="Возложение рук",
        kind="class",
        available_stats=["cha"],
        summary="Кожа к коже — божественное исцеление или болезнь на вас.",
        trigger="Когда вы касаетесь кого-то кожа к коже и молитесь о его здоровье...",
        effect="Брось +CHA.",
        effect_10_plus="Излечите цели 1d8 урона или одну болезнь.",
        effect_7_9="Цель вы лечите, но её заболевания или урон переходят на вас.",
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="paladin_armored",
        title="Привычный к доспехам",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Броня не делает вас неуклюжим.",
        trigger="",
        effect="Вы игнорируете свойство неуклюжий, которое накладывает броня.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_i_am_the_law",
        title="Я есть Закон",
        kind="class",
        available_stats=["cha"],
        summary="Божественный приказ персонажу ведущего.",
        trigger=(
            "Когда вы, взывая к власти, данной вам божеством, "
            "отдаёте персонажу ведущего приказ..."
        ),
        effect="Брось +CHA.",
        effect_10_plus=(
            "Они, на свой выбор: исполняют приказ; медленно отступают, а затем бегут; "
            "атакуют вас. Сверх того получаете +1 на следующий ход против них."
        ),
        effect_7_9=(
            "Они, на свой выбор: исполняют приказ; медленно отступают, а затем бегут; атакуют вас."
        ),
        effect_6_minus="Они действуют, как хотят; вы получаете −1 на следующий ход против них.",
        grant_resources=[
            MoveGrantResource(
                spec_id="forward",
                amount=1,
                on_tier=["10_plus"],
                target="self",
                filter_moves=["paladin_i_am_the_law"],
                description="+1 на следующий ход против них (10+).",
            ),
        ],
    ),
    Move(
        id="paladin_quest",
        title="Священная миссия",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Святая цель, два дара свыше и обеты, пока миссия не завершена.",
        trigger=(
            "Когда вы ставите перед собой святую цель, сопровождая клятву молитвами "
            "и обрядом очищения..."
        ),
        effect=(
            "Выберите цель миссии ({{quest_goal}}: {{quest_target}}). "
            "Затем выберите два дара свыше: {{quest_gift_1}} и {{quest_gift_2}} "
            "(при необходимости уточните: {{quest_gift_detail_1}}, {{quest_gift_detail_2}}). "
            "Ведущий назначит обеты, которым нужно следовать, чтобы не лишиться благословения: "
            "{{quest_oaths}}."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=[
            MovePlaceholder(
                id="quest_goal",
                label="Цель миссии",
                kind="enum",
                required=True,
                options=list(_QUEST_GOAL_OPTIONS),
            ),
            MovePlaceholder(
                id="quest_target",
                label="Кого или что (цель)",
                kind="text",
                required=True,
            ),
            MovePlaceholder(
                id="quest_gift_1",
                label="Первый дар свыше",
                kind="enum",
                required=True,
                options=list(_QUEST_GIFT_OPTIONS),
            ),
            MovePlaceholder(
                id="quest_gift_2",
                label="Второй дар свыше",
                kind="enum",
                required=True,
                options=list(_QUEST_GIFT_OPTIONS),
            ),
            MovePlaceholder(
                id="quest_gift_detail_1",
                label="Уточнение первого дара (направление, неуязвимость…)",
                kind="text",
                required=False,
            ),
            MovePlaceholder(
                id="quest_gift_detail_2",
                label="Уточнение второго дара",
                kind="text",
                required=False,
            ),
            MovePlaceholder(
                id="quest_oaths",
                label="Обеты (ведущий)",
                kind="text",
                required=True,
            ),
        ],
    ),
    Move(
        id="paladin_divine_patronage",
        title="Божественное покровительство",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Божество, причастие и жреческие заклинания как у жреца 1 уровня.",
        trigger="",
        effect=(
            "Выберите божество {{deity}} (новое или из уже известных). "
            "Вы получаете ходы «Причастие» (cleric_commune) и «Сотворить заклинание» "
            "(cleric_cast_a_spell) и можете использовать жреческие заклинания. "
            "Считайте себя жрецом 1 уровня; при каждом повышении уровня паладина "
            "уровень жреческих способностей также увеличивается на 1."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=[
            MovePlaceholder(
                id="deity",
                label="Божество",
                kind="text",
                required=True,
            ),
        ],
    ),
    Move(
        id="paladin_bloody_shield",
        title="Кровавый щит",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Подавить боль волей — урон превращается в травму.",
        trigger="Когда вы получаете урон...",
        effect=(
            "Можете сжать зубы и подавить боль усилием воли: тогда вы не получаете урона, "
            "но получаете одну травму (на ваш выбор). Если у вас уже все шесть травм, "
            "этот ход недоступен."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_smite",
        title="Карающий удар",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1d4 к урону, пока исполняете священную миссию.",
        trigger="",
        effect="Исполняя священную миссию, вы получаете бонус 1d4 к урону.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        damage_mods=[
            DamageModifier(
                extra_dice=["d4"],
                on_tier=["any_hit"],
                target="target",
                description="+1d4 при священной миссии",
            ),
        ],
    ),
    Move(
        id="paladin_exterminatus",
        title="Экстерминатус",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Клятва на врага: +2d4 по нему, −4 по остальным до победы или искупления.",
        trigger="Когда вы выкрикиваете клятву победить какого-либо врага...",
        effect=(
            "Вы наносите ему на 2d4 урона больше, однако остальным — на 4 урона меньше. "
            "Это продолжается, пока противник не будет побеждён. Если не удалось или вы вышли из боя, "
            "можете признать провал — эффект сохраняется, пока не найдёте способ искупить вину."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_charge",
        title="В атаку!",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Отряд под вашим началом получает +1 на следующий ход.",
        trigger="Когда вы ведёте свой отряд в атаку...",
        effect="Персонажи под вашим началом получают +1 на следующий ход.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_steadfast_defender",
        title="Стойкий защитник",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="При «Встать на защиту» всегда запас 1, даже на 6−.",
        trigger="",
        effect="Когда вы встаёте на защиту кого-то, всегда получаете запас 1, даже при 6−.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_coordinated_attack",
        title="Помощь в атаке",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="После руби и кромсай — союзник бьёт цель на +1d4.",
        trigger="Когда вы рубите и кромсаете противника...",
        effect=(
            "Выберите союзника. Его атака против этой цели наносит на 1d4 урона больше."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_holy_protection",
        title="Святая защита",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1 к броне, пока исполняете священную миссию.",
        trigger="",
        effect="Вы получаете +1 к броне, пока исполняете священную миссию.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_armed_with_authority",
        title="Облечённый властью",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1 к приказам наёмникам.",
        trigger="",
        effect="Вы получаете бонус +1 к приказам наёмникам.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_hospitaller",
        title="Госпитальер",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Лечение союзника — на 1d8 урона больше.",
        trigger="Когда вы лечите союзника...",
        effect="Вы излечиваете на 1d8 урона больше.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_multiclass_dabbler",
        title="Мультикласс: дилетант",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Ход другого класса на уровень ниже.",
        trigger="",
        effect=MULTICLASS_EFFECT_TEXT,
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
    Move(
        id="paladin_mark_of_faith",
        title="Знак веры",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Узнать божество и суть божественной магии; +1, действуя по ответам.",
        trigger="Когда вы видите божественную магию...",
        effect=(
            "Можете спросить ведущего, от какого божества она исходит и как действует. "
            "Получите бонус +1, если действуете согласно ответам."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        condition=MoveCondition(requires_moves=["paladin_divine_patronage"]),
    ),
    Move(
        id="paladin_holy_strike",
        title="Святой удар",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Карающий удар. +1d8 к урону при миссии.",
        trigger="",
        effect="Исполняя священную миссию, вы получаете бонус 1d8 к урону.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        damage_mods=[
            DamageModifier(
                extra_dice=["d8"],
                on_tier=["any_hit"],
                target="target",
                description="+1d8 при священной миссии",
            ),
        ],
    ),
    Move(
        id="paladin_forward_only",
        title="Только вперёд!",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: В атаку! Отряд: +1 на ход и +2 к броне на следующий ход.",
        trigger="Когда вы ведёте свой отряд в атаку...",
        effect=(
            "Идущие за вами получают +1 на следующий ход и +2 к броне на следующий ход."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_unshakeable_defender",
        title="Непоколебимый защитник",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Стойкий защитник. Запас 1 на 6−; на 12+ враг в сложном положении.",
        trigger="",
        effect=(
            "Когда вы встаёте на защиту кого-либо, вы всегда получаете запас 1, даже при 6−. "
            "Если на броске выпадает 12+, вы не получаете запаса, но ближайший атакующий вас враг "
            "оказывается в сложном положении — явное преимущество, которое опишет ведущий."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_joint_attack",
        title="Совместная атака",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Помощь в атаке. Союзник: +1d4 урона и +1 вперёд против цели.",
        trigger="Когда вы рубите и кромсаете противника...",
        effect=(
            "Выберите союзника. Его атака против этой цели наносит на 1d4 урона больше, "
            "и он получает +1 на следующий ход против них."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_divine_armor",
        title="Божественная защита",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Святая защита. +2 к броне при миссии.",
        trigger="",
        effect="Вы получаете +2 к броне, пока исполняете священную миссию.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_armed_with_authority_supreme",
        title="Облечённый властью свыше",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Облечённый властью. +1 к приказам; на 12+ наёмники исполняют с рвением.",
        trigger="",
        effect=(
            "Вы получаете бонус +1 к приказам наёмникам. Если вы получаете 12+, наёмники быстро "
            "преодолевают мгновение страха и сомнений и выполняют ваши приказы "
            "с исключительной точностью и рвением."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_perfect_hospitaller",
        title="Идеальный госпитальер",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Госпитальер. Исцеляете на 2d8 урона больше.",
        trigger="Когда вы лечите союзника...",
        effect="Исцеляя союзника, вы излечиваете на 2d8 урона больше.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_indomitable",
        title="Неукротимый",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="После травмы (в т.ч. от «Кровавого щита») +1 против её причины.",
        trigger="",
        effect=(
            "Если вы получили травму (в том числе от хода «Кровавый щит»), "
            "получите +1 на следующий ход, направленный против причины этой травмы."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="paladin_perfect_knight",
        title="Идеальный рыцарь",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="При священной миссии выберите три дара свыше вместо двух.",
        trigger="",
        effect="Исполняя священную миссию, выберите три дара свыше вместо двух.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
]
