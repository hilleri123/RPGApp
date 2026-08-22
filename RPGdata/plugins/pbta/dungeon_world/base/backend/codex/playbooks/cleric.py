from __future__ import annotations

from plugins.pbta.base.backend.types import Move, Playbook
from plugins.pbta.base.backend.types.types_classes import MovePlaceholder
from ..multiclass_options import MULTICLASS_EFFECT_TEXT, MULTICLASS_MOVE_PLACEHOLDERS

_SPELL_PICK = [
    MovePlaceholder(
        id="picked_spell",
        label="Заклинание",
        kind="move_pick",
        required=True,
    ),
]

cleric_moves: list[Move] = [
    Move(
        id="cleric_deity",
        title="Божество",
        kind="class",
        available_stats=[],
        summary="Божество, домен, заповеди и принципы вашей веры.",
        trigger="",
        effect=(
            "Вы служите и поклоняетесь божеству, которое дарует вам заклинания. "
            "Дайте ему или ей имя (скажем, Гельферт, Сакеллус, Зорика или Крагон Суровый) "
            "и выберите домен божества: исцеление и восстановление; знание и то, что сокрыто; "
            "кровавые битвы; униженные и забытые; цивилизация; те, кто спит в глубинах. "
            "Выберите принципы своей религии: святость страданий (заповедь: мученичество); "
            "закрытый культ (заповедь: тайные знания); жертвоприношения (заповедь: подношения); "
            "бой — лучшее испытание (заповедь: личная победа)."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_divine_sign",
        title="Знак свыше",
        kind="class",
        available_stats=[],
        summary="Следуя заветам веры, вы получаете дар от бога.",
        trigger="Когда вы следуете заветам своей веры...",
        effect=(
            "Бог посылает вам полезное знание или иной дар, связанный со своим доменом. "
            "Ведущий сообщит, что именно."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_turn_undead",
        title="Изгнание нежити",
        kind="class",
        available_stats=["wis"],
        summary="Символ веры и молитва отталкивают живых мертвецов.",
        trigger="Когда вы поднимаете символ своей веры и взываете к божеству...",
        effect="Брось +WIS.",
        effect_10_plus=(
            "Живые мертвецы не могут приблизиться к вам, пока вы молитесь и сжимаете святой символ. "
            "Разумная нежить может портить вам жизнь издалека. "
            "Вы также на несколько мгновений ошеломляете разумную нежить, "
            "а неразумную обращаете в бегство. Враждебное поведение сводит эффект на нет."
        ),
        effect_7_9=(
            "Живые мертвецы не могут приблизиться к вам, пока вы молитесь и сжимаете святой символ. "
            "Разумная нежить, однако, может найти способ портить вам жизнь издалека."
        ),
        effect_6_minus="Ведущий делает ход.",
    ),
    Move(
        id="cleric_prayer",
        title="Молитва",
        kind="class",
        available_stats=[],
        summary="Час молитвы обновляет заклинания и псалмы.",
        trigger=(
            "Когда вы проводите около часа в спокойной молитве своему божеству, "
            "никем и ничем не прерываемые..."
        ),
        effect=(
            "Вы теряете все ниспосланные вам на данный момент заклинания. "
            "Получаете новые заклинания на выбор: сумма их уровней не должна превышать ваш уровень+1, "
            "и ни одно не может быть уровнем выше вашего. "
            "Подготавливаете все ваши псалмы; при подсчёте суммы уровней заклинаний они не учитываются."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_cast_a_spell",
        title="Сотворить заклинание",
        kind="class",
        available_stats=["wis"],
        casts_spell=True,
        summary="Жреческое заклинание по воле божества.",
        trigger="Когда вы творите жреческое заклинание...",
        effect="Брось +WIS.",
        effect_10_plus="У вас получается; заклинание остаётся при вас.",
        effect_7_9=(
            "У вас получается. Выберите одно: вы привлекаете нежелательное внимание или оказываетесь "
            "в сложной ситуации (ведущий сообщит подробности); применение магии отдаляет вас от божества — "
            "у вас -1 на все броски сотворения заклинаний до следующей молитвы; после сотворения заклинания "
            "божество забирает его у вас — чтобы использовать снова, нужно провести около часа в молитве. "
            "Поддержка длительных заклинаний иногда накладывает штраф на ваши броски заклинаний."
        ),
        effect_6_minus="Ведущий делает ход.",
    ),
    Move(
        id="cleric_chosen_one",
        title="Избранник",
        kind="advanced",
        available_stats=[],
        summary="Одно выбранное заклинание считается на 1 уровень ниже при получении от бога.",
        trigger="",
        effect=(
            "Выберите одно заклинание ({{picked_spell}}). Когда божество ниспосылает его вам, "
            "считайте, что уровень этого заклинания меньше на 1."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(_SPELL_PICK),
    ),
    Move(
        id="cleric_inspiration",
        title="Воодушевление",
        kind="advanced",
        available_stats=[],
        summary="Исцеление даёт союзнику бонус к следующему урону.",
        trigger="",
        effect="Когда вы лечите кого-то, он получает +2 к следующему броску урона.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_between_life_death",
        title="Между жизнью и смертью",
        kind="advanced",
        available_stats=[],
        summary="Свидетель последнего вздоха получает бонус к броску.",
        trigger="",
        effect="Когда кто-то делает при вас последний вздох, он получает +1 к броску.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_serenity",
        title="Безмятежность",
        kind="advanced",
        available_stats=[],
        summary="Игнорируете первый штраф от длительных заклинаний.",
        trigger="",
        effect="Игнорируйте первый штраф -1 за действующие заклинания.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_first_aid",
        title="Первая помощь",
        kind="advanced",
        available_stats=[],
        summary="Исцеление лёгких ран — псалм, не в счёт уровней.",
        trigger="",
        effect=(
            "Исцелить лёгкие раны является для вас псалмом, и потому не учитывается "
            "при подсчёте суммы уровней заклинаний."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_divine_intervention",
        title="Божественное вмешательство",
        kind="advanced",
        available_stats=[],
        summary="После молитвы — запас, чтобы отменить урон союзнику или себе.",
        trigger="",
        effect=(
            "Помолившись, вы получаете запас 1 (теряя весь старый запас). "
            "Когда вы или союзник получаете урон, можете воззвать к божеству за 1 запас. "
            "Оно как-то вмешается (порыв ветра, вспышка света), и цель урона не получит."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_penitence",
        title="Покаяние",
        kind="advanced",
        available_stats=[],
        summary="Принять дополнительный урон ради бонуса к следующему заклинанию.",
        trigger="",
        effect=(
            "Когда вы, получая урон, принимаете боль с готовностью и радостью, "
            "можете согласиться на дополнительный 1к4 урона (сквозь броню), чтобы получить +1 "
            "на следующее заклинание."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_empower",
        title="Усиление",
        kind="advanced",
        available_stats=[],
        summary="На 10+ при сотворении можно взять последствие 7–9 ради дополнительного эффекта.",
        trigger="",
        effect=(
            "Когда вы творите заклинание, на 10+ можете выбрать один вариант из списка последствий "
            "для результатов 7–9. В таком случае вы можете выбрать ещё и один из этих эффектов: "
            "действенность заклинания удваивается; количество целей заклинания удваивается."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_pray_for_guidance",
        title="Мольба об указании пути",
        kind="advanced",
        available_stats=[],
        summary="Жертва и молитва — бог говорит, чего хочет; опыт за послушание.",
        trigger="Когда вы жертвуете божеству что-то ценное и молитесь, чтобы оно указало вам путь...",
        effect=(
            "Божество говорит, что хочет от вас. Если вы следуете его воле, запишите себе опыт."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_divine_protection",
        title="Божественная защита",
        kind="advanced",
        available_stats=[],
        summary="Броня 2 без щита и доспехов.",
        trigger="",
        effect="Если вы не используете щит или доспехи, то получаете броню 2.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_expert_healer",
        title="Опытный целитель",
        kind="advanced",
        available_stats=[],
        summary="К исцелённому урону добавляется ваш уровень.",
        trigger="",
        effect="Когда вы лечите кого-то, добавьте свой уровень к исцелённому урону.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_multiclass_dabbler",
        title="Мультикласс: дилетант",
        kind="advanced",
        available_stats=[],
        summary="Ход другого класса на уровень ниже.",
        trigger="",
        effect=MULTICLASS_EFFECT_TEXT,
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
    Move(
        id="cleric_anointed",
        title="Помазанник",
        kind="advanced",
        available_stats=[],
        summary="Требует: Избранник. Ещё одно заклинание с пониженным уровнем.",
        trigger="",
        effect=(
            "Требуется: Избранник. Выберите одно заклинание ({{picked_spell}}) вдобавок к тому, "
            "что дал вам ход «Избранник». Когда божество дарует его вам, считайте, "
            "что его уровень меньше на 1."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(_SPELL_PICK),
    ),
    Move(
        id="cleric_apotheosis",
        title="Богоподобие",
        kind="advanced",
        available_stats=[],
        summary="После церемонии и первой молитвы — постоянная черта божества.",
        trigger="",
        effect=(
            "Впервые помолившись божеству (и сопроводив это церемонией) после взятия этого хода, "
            "выберите связанную с божеством черту (лазурные крылья, всевидящее око и т.д.). "
            "Вы навсегда получаете эту особенность."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_reaper",
        title="Жнец",
        kind="advanced",
        available_stats=[],
        summary="После победы — посвящение богу и похороны мёртвых.",
        trigger="",
        effect=(
            "Если после схватки вы тратите какое-то время, чтобы посвятить победу божеству "
            "и похоронить мёртвых, вы получаете +1 на следующий ход."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_providence",
        title="Провидение",
        kind="advanced",
        available_stats=[],
        summary="Заменяет: Безмятежность. Игнорируете -1 от двух длительных заклинаний.",
        trigger="",
        effect=(
            "Заменяет: Безмятежность. Когда вы творите заклинание, игнорируйте штраф -1 "
            "от двух длительных заклинаний, которые вы поддерживаете."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_great_first_aid",
        title="Великая первая помощь",
        kind="advanced",
        available_stats=[],
        summary="Исцеление средних ран — псалм, не в счёт уровней.",
        trigger="",
        effect=(
            "Исцелить средние раны является для вас псалмом, и потому не учитывается "
            "при подсчёте суммы уровней заклинаний."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_divine_invulnerability",
        title="Божественная неуязвимость",
        kind="advanced",
        available_stats=[],
        summary="Заменяет: Божественное вмешательство. Запас 2 вместо 1.",
        trigger="",
        effect=(
            "Заменяет: Божественное вмешательство. Помолившись, вы получаете запас 2 "
            "(теряя весь старый запас). Когда вы или союзник получаете урон, "
            "можете воззвать к божеству за 1 запас. Оно как-то вмешается "
            "(порыв ветра, вспышка света), и цель урона не получит."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_martyr",
        title="Мученик",
        kind="advanced",
        available_stats=[],
        summary="Заменяет: Покаяние. Боль за усиление заклинания и урона.",
        trigger="",
        effect=(
            "Заменяет: Покаяние. Когда вы покорно принимаете боль от урона, "
            "можете принять ещё +1к4 урона (сквозь броню), а за это — +1 на следующий бросок "
            "сотворения заклинания и бонус к наносимому/исцеляемому урону, равный вашему уровню."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_divine_armor",
        title="Божественный доспех",
        kind="advanced",
        available_stats=[],
        summary="Заменяет: Божественная защита. Броня 3 без щита и доспехов.",
        trigger="",
        effect=(
            "Заменяет: Божественная защита. Если вы не используете щит или доспехи, "
            "то получаете броню 3."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_great_empowerment",
        title="Великое усиление",
        kind="advanced",
        available_stats=[],
        summary="Заменяет: Усиление. На 10–11 и 12+ — расширенные эффекты.",
        trigger="",
        effect=(
            "Заменяет: Усиление. Когда вы творите заклинание, на 10–11 можете выбрать последствие "
            "из списка для 7–9, а за это — один из перечисленных ниже эффектов. "
            "На 12+ вы можете выбрать эффект, ничем не жертвуя: "
            "действенность заклинания увеличивается вдвое; количество целей заклинания увеличивается вдвое."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="cleric_multiclass_dabbler_6",
        title="Мультикласс: дилетант",
        kind="advanced",
        available_stats=[],
        summary="Ход другого класса на уровень ниже (уровни 6–10).",
        trigger="",
        effect="Возьмите ход другого класса, исходя из того, что ваш уровень ниже на 1.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
]

cleric = Playbook(
    id="cleric",
    title="Жрец",
    archetype="mystic",
    summary=(
        "Ты — голос своего бога в мире тьмы, чудовищ и греха. "
        "Твои молитвы исцеляют, изгоняют и приказывают."
    ),
    base_hp=8,
    base_load=10,
    damage_die="d6",
    starting_moves=[
        "cleric_deity",
        "cleric_divine_sign",
        "cleric_turn_undead",
        "cleric_prayer",
        "cleric_cast_a_spell",
    ],
    advanced_moves=[
        "cleric_chosen_one",
        "cleric_inspiration",
        "cleric_between_life_death",
        "cleric_serenity",
        "cleric_first_aid",
        "cleric_divine_intervention",
        "cleric_penitence",
        "cleric_empower",
        "cleric_pray_for_guidance",
        "cleric_divine_protection",
        "cleric_expert_healer",
        "cleric_multiclass_dabbler",
    ],
    advanced_moves_6_10=[
        "cleric_anointed",
        "cleric_apotheosis",
        "cleric_reaper",
        "cleric_providence",
        "cleric_great_first_aid",
        "cleric_divine_invulnerability",
        "cleric_martyr",
        "cleric_divine_armor",
        "cleric_great_empowerment",
        "cleric_multiclass_dabbler_6",
    ],
)
