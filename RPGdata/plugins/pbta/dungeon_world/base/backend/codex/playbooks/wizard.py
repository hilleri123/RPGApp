from __future__ import annotations

from plugins.pbta.base.backend.types import Move, MoveGrantResource, Playbook
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

wizard_moves: list[Move] = [
    Move(
        id="wizard_spellbook",
        title="Книга заклинаний",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Записанные заклинания и фокусы; книга весит 1.",
        trigger="",
        effect=(
            "Вы выучили несколько заклинаний и записали их в книгу. Вы начинаете игру с тремя "
            "заклинаниями первого уровня и всеми фокусами. Получив новый уровень, вы записываете "
            "в книгу новое заклинание вашего уровня или ниже. Книга заклинаний имеет вес 1."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_prepare_spells",
        title="Подготовка заклинаний",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Час с книгой — выбрать подготовленную магию на день.",
        trigger="Когда вы проводите около часа за изучением книги заклинаний...",
        effect=(
            "Вы теряете все подготовленные заклинания; готовите новые — их уровни в сумме "
            "не могут превышать ваш уровень +1; готовите фокусы (они не учитываются в сумме уровней)."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_cast_a_spell",
        title="Сотворить заклинание",
        kind="class",
        available_stats=["int"],
        casts_spell=True,
        summary="Выпускаете заранее подготовленное заклинание.",
        trigger="Когда вы творите подготовленное заклинание...",
        effect="Брось +INT.",
        effect_10_plus="Заклинание сотворено и не стирается из вашей памяти.",
        effect_7_9=(
            "Вы также творите заклинание, но выбираете один из вариантов: "
            "вы привлекаете нежелательное внимание или оказываетесь в сложном положении — "
            "ведущий расскажет подробности; "
            "заклинание искажает ткань реальности — вы получаете штраф -1 на сотворение заклинаний, "
            "пока не подготовите их снова; "
            "сотворённое заклинание забывается, его нужно вновь подготовить. "
            "Поддержка длительных заклинаний даёт штраф на броски заклинаний."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="wizard_magic_defense",
        title="Магическая защита",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Прервать длительное заклинание, чтобы уменьшить полученный урон.",
        trigger="Когда вам только что нанесли урон...",
        effect=(
            "Прервите любое длительное заклинание, чтобы, использовав его остаточную энергию, "
            "вычесть его уровень из только что нанесённого вам урона."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_ritual",
        title="Ритуал",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Мощная магия в месте силы — результат достижим, но с условиями.",
        trigger="Если вы используете место силы для сотворения мощной магии...",
        effect=(
            "Скажите ведущему, какой результат хотите получить. Он достижим всегда, но ведущий "
            "может поставить перед вами от одного до четырёх условий из списка: "
            "ритуал займёт несколько дней, недель или месяцев; "
            "вначале вы должны выполнить особое требование; "
            "вам нужна помощь от кого-то; "
            "на это уйдёт много денег; "
            "результат будет лишь слабым подобием задуманного; "
            "вы и ваши союзники рискуете чем-то серьёзным; "
            "вам нужно снять зачарование с предмета, чтобы сделать это."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_talent",
        title="Талант",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Одно выбранное заклинание считается на 1 уровень ниже при подготовке.",
        trigger="",
        effect=(
            "Выберите заклинание ({{picked_spell}}). Подготавливая его, считайте, "
            "что уровень этого заклинания ниже на 1."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(_SPELL_PICK),
    ),
    Move(
        id="wizard_empowered_magic",
        title="Усиление магии",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="На 10+ при сотворении можно взять последствие 7–9 ради дополнительного эффекта.",
        trigger="",
        effect=(
            "Когда вы творите заклинание, на 10+ можете выбрать одно последствие из списка на 7–9, "
            "и за это выбрать дополнительный эффект: действительность заклинания максимальна; "
            "количество целей заклинания удваивается."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_pen_in_blood",
        title="Что написано пером",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1 к знанию о том, чего другие даже не представляют.",
        trigger="",
        effect=(
            "Если вы копаетесь в памяти на предмет сведений о чём-то, о чём остальные не имеют "
            "даже понятия, получите +1."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_know_it_all",
        title="Всезнайка",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Совет союзникам даёт им +1 и вам опыт.",
        trigger="",
        effect=(
            "Когда персонажи других игроков приходят к вам за советом, изложите им своё мнение "
            "по вопросу. Если они последуют вашему совету, то получают +1 на следующий ход, "
            "а вы записываете опыт."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        grant_resources=[
            MoveGrantResource(
                spec_id="forward",
                amount=1,
                on_tier=["any_hit"],
                target="ally",
                filter_moves=["wizard_know_it_all"],
                description="+1 на следующий ход, если последовали совету.",
            ),
        ],
    ),
    Move(
        id="wizard_expanded_spellbook",
        title="Расширенная книга заклинаний",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Новое заклинание из списка любого класса.",
        trigger="",
        effect="Добавьте в книгу новое заклинание ({{picked_spell}}) из списка любого класса.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(_SPELL_PICK),
    ),
    Move(
        id="wizard_arcanist",
        title="Знаток чар",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Изучение волшебного предмета в безопасности.",
        trigger=(
            "Если вы можете провести некоторое время за изучением волшебного предмета "
            "в безопасной обстановке..."
        ),
        effect="Можете спросить ведущего, как этот предмет действует. Ведущий ответит вам честно.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_logic",
        title="Логика",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Изучать обстановку через дедукцию с ИНТ вместо МДР.",
        trigger="",
        effect=(
            "Если вы анализируете окружающую среду с помощью чистой дедукции, "
            "вы можете изучать обстановку, используя INT, а не WIS."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_wizardly_ward",
        title="Волшебный оберег",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+2 к броне, пока есть готовое заклинание 1+ уровня.",
        trigger="",
        effect="Пока у вас есть хоть одно готовое заклинание уровня 1+, у вас +2 к броне.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_spell_deflection",
        title="Отражение заклинаний",
        kind="advanced",
        available_stats=["int"],
        summary="Потратить подготовленное заклинание, чтобы отразить чужую магию.",
        trigger="Когда вы пытаетесь отразить заклинание, которое иначе вас заденет...",
        effect=(
            "Выберите одно из приготовленных заклинаний и используйте его энергию для защиты. "
            "Брось +INT."
        ),
        effect_10_plus="Вы успешно блокируете заклинание.",
        effect_7_9=(
            "Эффект тот же, но заклинание, использованное для защиты, стирается у вас из памяти. "
            "Блок защищает лишь вас; если магия имела иные цели, она действует на них, как обычно."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="wizard_quick_study",
        title="Быстрое обучение",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Увидев заклинание, узнать его название и эффекты.",
        trigger="Когда вы видите какое-то волшебное заклинание в действии...",
        effect=(
            "Спросите у ведущего его название и эффекты. "
            "Вы получаете +1, если действуете, активно пользуясь полученными сведениями."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        grant_resources=[
            MoveGrantResource(
                spec_id="forward",
                amount=1,
                on_tier=["any_hit"],
                target="self",
                filter_moves=["wizard_quick_study"],
                description="+1, действуя по полученным сведениям.",
            ),
        ],
    ),
    Move(
        id="wizard_multiclass_dabbler",
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
        id="wizard_master",
        title="Мастер",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Требует: Талант. Ещё одно заклинание с пониженным уровнем при подготовке.",
        trigger="",
        effect=(
            "Требуется: Талант. Выберите одно заклинание ({{picked_spell}}) в дополнение к тому, "
            "что дал вам талант. Подготавливая его, считайте, что уровень этого заклинания ниже на 1."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(_SPELL_PICK),
    ),
    Move(
        id="wizard_greater_empowerment",
        title="Великое усиление магии",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Усиление магии. На 12+ эффект без жертвы.",
        trigger="",
        effect=(
            "Заменяет: Усиление магии. Когда вы творите заклинание, на 10+ вы можете выбрать "
            "один вариант из списка последствий для результатов 7–9; тогда можете также выбрать "
            "один из вариантов: действительность заклинания максимальна; количество целей удваивается. "
            "На 12+ вы можете выбрать эффект, ничем не жертвуя при этом."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_soul_of_magic",
        title="Душа чар",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Требует: Знаток чар. Зарядить предмет в месте силы.",
        trigger="",
        effect=(
            "Требуется: Знаток чар. Если у вас есть возможность провести некоторое время "
            "в месте силы (в безопасности) и есть волшебный предмет, можете зарядить этот предмет, "
            "усилив его. Ведущий определит, в чём именно это выражается."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_iron_logic",
        title="Железная логика",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Логика. На 12+ — любые три вопроса ведущему.",
        trigger="",
        effect=(
            "Заменяет: Логика. Анализируя окружающую среду с помощью чистой дедукции, "
            "вы можете изучать обстановку, используя INT, а не WIS. "
            "На 12+ вы можете задать ведущему любые три вопроса, не обязательно из списка."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_arcane_armor",
        title="Волшебная броня",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Волшебный оберег. +4 к броне при готовом заклинании 1+.",
        trigger="",
        effect=(
            "Заменяет: Волшебный оберег. Пока у вас есть хоть одно готовое заклинание уровня 1+, "
            "у вас +4 к броне."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_reflection_field",
        title="Поле отражения",
        kind="advanced",
        available_stats=["int"],
        summary="Требует: Отражение заклинаний. Защищает видимых союзников.",
        trigger="Когда вы отражаете заклинание, направленное на вас или видимого союзника...",
        effect=(
            "Требует: Отражение заклинаний. Вы можете отражать заклинания от себя и видимых союзников. "
            "Если заклинание направлено на нескольких союзников, вы должны отразить его "
            "(и сделать нужные броски) для каждого по отдельности."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_invisible_bond",
        title="Незримая связь",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Магическая связь с существом на расстоянии.",
        trigger="",
        effect=(
            "Вы умеете создавать незримую связь с другим существом (добровольцем или обездвиженной "
            "жертвой). Нужно лишь провести некоторое время с объектом чар — после этого вы сможете "
            "чувствовать то, что чувствует цель, и изучать обстановку вокруг цели, невзирая на расстояние. "
            "Если связь создана с добровольцем, он может общаться с вами, будто вы в одной комнате."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_puppet_strings",
        title="Нити марионетки",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Контролируемая цель не помнит принуждения.",
        trigger="",
        effect=(
            "Когда вы контролируете чьи-то действия магией, впоследствии цель не помнит, "
            "что вы заставляли её делать, и не держит на вас зла."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_spell_energy",
        title="Энергия заклинания",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Завершить длительное заклинание, чтобы добавить его уровень к урону.",
        trigger="Когда вы наносите урон существу...",
        effect=(
            "Вы можете усилить этот урон магической энергией — завершите одно из длительных заклинаний "
            "и добавьте его уровень к нанесённому урону."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="wizard_power_of_my_own",
        title="Собственная сила",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Создать своё место силы обрядом.",
        trigger="",
        effect=(
            "Если у вас есть время и компоненты для магического обряда, вы можете создать "
            "ваше собственное место силы. Опишите ведущему, какой силой вы планируете его наделить "
            "и каким образом вы привязываете эту силу к месту. Ведущий, в свою очередь, называет вам "
            "один из видов существ, чей интерес привлекает ваша работа."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
]


wizard = Playbook(
    id="wizard",
    title="Волшебник",
    archetype="mystic",
    summary=(
        "Ты изучал тайные формулы мира и научился переписывать реальность. "
        "Пусть другие молятся о чуде — ты его готовишь с утра."
    ),
    base_hp=4,
    base_load=7,
    damage_die="d4",
    starting_moves=[m.id for m in wizard_moves if m.kind == "class"],
    advanced_moves=[
        "wizard_talent",
        "wizard_empowered_magic",
        "wizard_pen_in_blood",
        "wizard_know_it_all",
        "wizard_expanded_spellbook",
        "wizard_arcanist",
        "wizard_logic",
        "wizard_wizardly_ward",
        "wizard_spell_deflection",
        "wizard_quick_study",
        "wizard_multiclass_dabbler",
    ],
    advanced_moves_6_10=[
        "wizard_master",
        "wizard_greater_empowerment",
        "wizard_soul_of_magic",
        "wizard_iron_logic",
        "wizard_arcane_armor",
        "wizard_reflection_field",
        "wizard_invisible_bond",
        "wizard_puppet_strings",
        "wizard_spell_energy",
        "wizard_power_of_my_own",
    ],
)
