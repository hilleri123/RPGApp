from __future__ import annotations

from plugins.pbta.base.backend.types import Move, MoveGrantResource, Playbook
from ..multiclass_options import MULTICLASS_EFFECT_TEXT, MULTICLASS_MOVE_PLACEHOLDERS


bard_moves: list[Move] = [
    Move(
        id="bard_arcane_art",
        title="Магия искусства",
        kind="class",
        available_stats=["cha"],
        summary="Вплетаете магию в выступление ради союзника.",
        trigger="Когда вы вплетаете выступление в заклинание барда...",
        effect=(
            "Выберите союзника и эффект: цель излечивает 1к8 урона; цель получает +1к4 к следующему броску урона; "
            "разум цели очищается от одного зачарования; следующая успешная попытка помочь цели даст ей +2, а не +1. "
            "Потом бросьте +ХАР."
        ),
        effect_10_plus="На союзника накладывается выбранный эффект.",
        effect_7_9=(
            "Ваше заклинание работает, однако, по выбору ведущего, вы либо привлекли нежелательное внимание, "
            "либо ваше колдовство отразилось на другие цели, подействовав и на них тоже."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="bard_bardic_lore",
        title="Знание барда",
        kind="class",
        available_stats=["int"],
        summary="Специализация и первый вопрос к мастеру о важном объекте.",
        trigger=(
            "Когда вы впервые сталкиваетесь с важным существом, предметом или местом (по вашему мнению), "
            "если это связано со сферой ваших знаний барда..."
        ),
        effect=(
            "Выберите сферу: заклинания и магия; мёртвые и нежить; знаменательные исторические события изведанного мира; "
            "необычные существа; планарные сферы; легенды о героях былых времён; боги и те, кто им служит. "
            "Можете задать ведущему один вопрос об этом. Ведущий ответит честно. Он может спросить, из какой сказки, "
            "песни или легенды вам известна эта информация."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="bard_charming_and_open",
        title="Обаятельный и искренний",
        kind="class",
        available_stats=["cha"],
        summary="Откровенный разговор и честные ответы на вопросы.",
        trigger="Когда вы разговариваете с кем-то откровенно...",
        effect=(
            "Вы можете задать игроку, которому принадлежит этот персонаж, один вопрос из списка ниже. "
            "Игрок должен дать честный ответ, а потом, в свою очередь, тоже задать вопрос из списка "
            "(на который вы также должны ответить честно).\n"
            "• Кому ты служишь?\n"
            "• Что бы ты хотел, чтобы я сделал?\n"
            "• Как я могу убедить тебя сделать ________?\n"
            "• Скажи честно, что ты чувствуешь в данный момент?\n"
            "• Каково твоё самое сокровенное желание?"
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="bard_a_safe_place",
        title="Тихая гавань",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Возвращение в знакомое поселение.",
        trigger="Когда вы возвращаетесь в поселение, где уже бывали раньше...",
        effect=(
            "Скажите ведущему, когда это произошло. Он расскажет вам, что изменилось здесь за прошедшее время."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),

    
    Move(
        id="bard_healing_song",
        title="Целительная песнь",
        kind="advanced",
        available_stats=["cha"],
        summary="Исцеляющая магия искусства становится сильнее.",
        trigger="Когда вы используете магию искусства для исцеления...",
        effect="Вы лечите дополнительно 1к8 урона.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_monstrous_cacophony",
        title="Чудовищная какофония",
        kind="advanced",
        available_stats=["cha"],
        summary="Бонус к урону от магии искусства становится больше.",
        trigger="Когда вы используете магию искусства, чтобы дать бонус к урону...",
        effect="Бонус вырастает на 1к4.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_volume_up",
        title="Громкость на полную",
        kind="advanced",
        available_stats=["cha"],
        summary="Безумная сила музыки заставляет врага ударить по своему союзнику.",
        trigger="Когда вы обрушиваете на врага всю безумную силу своей музыки...",
        effect=(
            "Выберите цель, которая может слышать вас, и бросьте +CHA."
        ),
        effect_10_plus="Вы заставляете цель атаковать своего ближайшего союзника.",
        effect_7_9=(
            "Она тоже атакует ближайшего союзника, но и вам не удастся избежать её "
            "внимания и гнева."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="bard_metallic_wail",
        title="Металлический вой",
        kind="advanced",
        available_stats=["con"],
        summary="Жуткий крик или разрушительный аккорд калечат и оглушают.",
        trigger="Когда вы жутко кричите или берёте разрушительный аккорд...",
        effect="Выберите цель и бросьте +CON.",
        effect_10_plus="Цель получает 1к10 урона и глохнет на несколько минут.",
        effect_7_9=(
            "Вы наносите урон, но сила выходит из-под контроля: ведущий выбирает "
            "вторую жертву заклинания."
        ),
        effect_6_minus="Сила выходит из-под контроля.",
    ),
    Move(
        id="bard_helping_hands",
        title="С небольшой помощью моих друзей",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Успешная помощь даёт вам собственный бонус.",
        trigger="Когда вы успешно помогли кому-то...",
        effect="Вы тоже получаете +1 на следующий ход.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_otherworldly_music",
        title="Неземная музыка",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Магия искусства позволяет выбрать два эффекта вместо одного.",
        trigger="Когда вы используете магию искусства...",
        effect="Можете выбрать два эффекта, а не один.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_duelist_parry",
        title="Дуэльное парирование",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="После руби и кромсай вы получаете больше брони.",
        trigger="Сделав ход руби и кромсай...",
        effect="Получите +1 к броне до конца следующего хода.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_outfox",
        title="Облапошить",
        kind="advanced",
        available_stats=["cha"],
        summary="При договорённости вы получаете бонус на следующий ход.",
        trigger="Когда вы договариваетесь с кем-то...",
        effect="При 7+ вы также получаете +1 на следующий ход, связанный с этой персоной.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_multiclass_dabbler",
        title="Мультикласс: дилетант",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Возьмите один ход другого класса.",
        trigger="",
        effect="Возьмите один ход другого класса, как будто ваш уровень ниже на 1.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
    Move(
        id="bard_multiclass_devotee",
        title="Мультикласс: посвящённый",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Возьмите один ход другого класса.",
        trigger="",
        effect="Возьмите один ход другого класса, как будто ваш уровень ниже на 1.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
    Move(
        id="bard_healing_choir",
        title="Целительный хор",
        kind="advanced",
        available_stats=["cha"],
        summary="Усиленная версия целительной песни.",
        trigger="Когда вы используете магию искусства для исцеления...",
        effect="Вы лечите на 2к8 урона больше.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_monstrous_chord",
        title="Чудовищный аккорд",
        kind="advanced",
        available_stats=["cha"],
        summary="Усиленная версия чудовищной какофонии.",
        trigger="Когда вы используете магию искусства, чтобы дать бонус к урону...",
        effect="Бонус вырастает на 2к4.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_unforgettable_face",
        title="Незабываемое лицо",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Встреча со знакомым даёт бонус.",
        trigger="Когда вы встречаете кого-то, с кем уже виделись...",
        effect="Вы получаете +1 на следующий бросок, связанный с ним.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_reputation",
        title="Репутация",
        kind="advanced",
        available_stats=["cha"],
        summary="Те, кто слышал о вас, уже имеют представление, кто вы.",
        trigger="Когда вы впервые встречаете кого-то, кто слышал песни о вас...",
        effect="Бросьте +CHA.",
        effect_10_plus=(
            "Назовите ведущему два факта, которые этот человек знает о вас."
        ),
        effect_7_9=(
            "Назовите ведущему один факт; второй факт скажет сам ведущий."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="bard_otherworldly_choir",
        title="Неземной хор",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Усиленная версия неземной музыки.",
        trigger="Когда вы используете магию искусства...",
        effect=(
            "Выберите два эффекта. Вы также можете усилить один из эффектов вдвое."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_magic_listening",
        title="Магический слух",
        kind="advanced",
        available_stats=["int"],
        summary="Вы слышите заклинание и узнаёте его эффект.",
        trigger="Когда вы слышите, как противник творит заклинание...",
        effect=(
            "Ведущий скажет вам название заклинания и его эффект. Получите +1 на "
            "следующий ход, если будете действовать в соответствии с этой информацией."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_evasion",
        title="Уклончивость",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Обаятельный и искренний даёт дополнительный вопрос.",
        trigger="Когда вы используете ход обаятельный и искренний...",
        effect=(
            "Вы также можете спросить: «Есть ли у тебя уязвимое место, которым я могу "
            "воспользоваться?» Тот, кого вы спрашиваете, не может задать этот вопрос вам."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_duelist_block",
        title="Блок дуэлянта",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="После руби и кромсай вы получаете больше брони.",
        trigger="Сделав ход руби и кромсай...",
        effect="Получите +2 к броне до конца следующего хода.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_outcheat",
        title="Обжулить",
        kind="advanced",
        available_stats=["cha"],
        summary="При договорённости вы получаете бонус на следующий бросок взаимодействия.",
        trigger="Когда вы договариваетесь с кем-то...",
        effect=(
            "При 7+ вы получаете +1 на следующий бросок взаимодействия с этим персонажем. "
            "Также вы можете задать игроку этого персонажа вопрос, на который тот обязан "
            "честно ответить."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="bard_multiclass_master",
        title="Мультикласс: мастер",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Возьмите один ход другого класса.",
        trigger="",
        effect="Возьмите один ход другого класса, как будто ваш уровень ниже на 1.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
]


bard = Playbook(
    id="bard",
    title="Бард",
    archetype="social",
    summary=(
        "Сказитель, певец и дипломат. "
        "Ты собираешь истории, живёшь ради славы и умеешь открывать двери словами, "
        "которые другим недоступны."
    ),
    base_hp=6,
    base_load=9,
    damage_die="d6",
    starting_moves=[
        "bard_arcane_art",
        "bard_bardic_lore",
        "bard_charming_and_open",
        "bard_a_safe_place",
    ],
    advanced_moves=[
        "bard_healing_song",
        "bard_monstrous_cacophony",
        "bard_volume_up",
        "bard_metallic_wail",
        "bard_helping_hands",
        "bard_otherworldly_music",
        "bard_duelist_parry",
        "bard_outfox",
        "bard_multiclass_dabbler",
        "bard_multiclass_devotee",
    ],
    advanced_moves_6_10=[
        "bard_healing_choir",
        "bard_monstrous_chord",
        "bard_unforgettable_face",
        "bard_reputation",
        "bard_otherworldly_choir",
        "bard_magic_listening",
        "bard_evasion",
        "bard_duelist_block",
        "bard_outcheat",
        "bard_multiclass_master",
    ],
)