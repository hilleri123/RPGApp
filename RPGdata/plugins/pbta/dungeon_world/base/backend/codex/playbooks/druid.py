from __future__ import annotations

from plugins.pbta.base.backend.types import Move, Playbook
from plugins.pbta.base.backend.types.types_classes import MovePlaceholder
from ..druid_options import DRUID_LANDS
from ..multiclass_options import MULTICLASS_EFFECT_TEXT, MULTICLASS_MOVE_PLACEHOLDERS


druid_moves: list[Move] = [
    Move(
        id="druid_born_of_the_soil",
        title="Дитя земли",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Духи вашей земли отметили вас и идут с вами.",
        trigger="",
        effect=(
            "Сильные и древние духи местности, где вы обучались магии, отметили вас как своего. "
            "Куда бы вы ни отправились, они остаются с вами и позволяют принимать свой облик. "
            "Ваша земля: {{land}} — это место, с которым у вас гармоничная связь. "
            "Превращаясь, вы можете принять облик любого животного из выбранной местности. "
            "Ваша метка: {{spirit_sign}} — черта, которая выдаёт в вас дитя земли и говорит о связи с духами. "
            "Это может быть черта, присущая животному, вроде пятен леопарда или рогов, или что-то иное: "
            "волосы, похожие на листья, блестящие как лёд глаза. Метка остаётся в любом облике."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=[
            MovePlaceholder(
                id="land",
                label="Родные земли",
                kind="enum",
                required=True,
                options=list(DRUID_LANDS),
            ),
            MovePlaceholder(
                id="spirit_sign",
                label="Знак духовной связи",
                kind="text",
                required=True,
            ),
        ],
    ),
    Move(
        id="druid_by_nature_sustained",
        title="Природа питает",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Вам не нужны еда и питьё.",
        trigger="",
        effect=(
            "Вам не нужно есть или пить. Если в ходе сказано «используйте паёк», не обращайте на это внимания."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_spirit_tongue",
        title="Язык духов",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Голоса диких животных вам понятны, как человеческая речь.",
        trigger="",
        effect=(
            "Хрюканье, лай, чириканье — голоса диких животных вам понятны, как человеческая речь. "
            "Вы можете понять любое животное, обитающее в ваших землях или чью сущность вы постигли."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_shapeshifter",
        title="Превращение",
        kind="class",
        available_stats=["wis"],
        summary="Взываете к духам и принимаете облик зверя, тратя запас на ходы животного.",
        trigger="Когда вы взываете к духам, чтобы поменять свой облик...",
        effect=(
            "Брось +WIS. Вы (со всеми вещами) можете превратиться в любое животное, которое водится "
            "в ваших землях, или сущность которого вы изучили. Вы перенимаете все сильные и слабые "
            "стороны животного: когти, крылья, жабры, способность дышать под водой (и неспособность "
            "дышать воздухом). Ваши характеристики остаются, хотя условия для некоторых ходов будет "
            "сложнее создать: домашней кошке с огром не тягаться. Ведущий также назовёт один или "
            "несколько ходов, доступных вашему новому обличью. Потратьте один запас, чтобы сделать "
            "такой ход. Когда запас заканчивается, вы возвращаетесь в своё обычное обличье. "
            "Вы также можете сделать это в любой момент, потратив весь оставшийся запас. "
            "Ходы животного описывают его обычное поведение, вроде «позвать стаю», «растоптать» "
            "или «улететь». Потратив запас, вы даёте волю его природным инстинктам и просто делаете ход."
        ),
        effect_10_plus="Вы получаете запас 3.",
        effect_7_9="Вы получаете запас 2.",
        effect_6_minus="Вы получаете последствия, которые назовёт ведущий, и запас 1.",
    ),
    Move(
        id="druid_hunter_brother",
        title="Брат охотника",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Один ход следопыта на вашем листе.",
        trigger="",
        effect="Выберите один ход из бланка следопыта.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_teeth_and_claws",
        title="Зубы и когти в крови",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="В обличье опасного зверя ваш урон — к8.",
        trigger="",
        effect="В обличье любого опасного животного ваш урон возрастает до к8.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_spirit_whispers",
        title="Шёпот духов",
        kind="advanced",
        available_stats=["wis"],
        summary="Видение от духов местности.",
        trigger="Когда вы хорошо изучили духов местности и взываете к ним...",
        effect="Брось +WIS.",
        effect_10_plus="Вам будет послано ясное и полезное видение, важное для вас, ваших союзников и духов рядом.",
        effect_7_9="Видение будет туманным и невнятным.",
        effect_6_minus=(
            "Видение печалит, пугает или ранит вас. Ведущий опишет, что вы увидели. Получите −1 на следующий ход."
        ),
    ),
    Move(
        id="druid_bark_skin",
        title="Кожа-кора",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1 к броне, если ступни касаются земли.",
        trigger="",
        effect="Вы получаете +1 к броне, если ваши ступни касаются земли.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_tigers_eye",
        title="Глаза тигра",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Видите глазами помеченного животного.",
        trigger="",
        effect=(
            "Оставив метку на теле животного (глиной, грязью или кровью), вы обретаете способность "
            "видеть его глазами независимо от расстояния между вами. Чтобы создать новую метку, "
            "необходимо избавиться от старой."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_shelter",
        title="Укрытие",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Отмена урона возвращением в истинный облик.",
        trigger="",
        effect=(
            "Когда вы получаете урон, будучи в обличье животного, вы можете отменить нанесённый урон, "
            "вернувшись в свой истинный облик."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_voice_of_the_unliving",
        title="Голоса неживого",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Превращение и язык духов работают на камни, растения и неодушевлённую природу.",
        trigger="",
        effect=(
            "Вашему взору доступны духи песка, камней и морских волн. Вы можете применять превращение, "
            "язык духов и постижение сущности к неодушевлённым природным предметам (камням, растениям "
            "и существам, сделанным из них). Обличья того, кто слышит голоса неживого, могут быть "
            "точными копиями вещей, в которые он превращается, или в них могут угадываться очертания "
            "фигуры друида."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_shapeshifter_master",
        title="Мастер превращений",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1 к одной характеристике в облике, −1 к другой по выбору ведущего.",
        trigger="",
        effect=(
            "Превращаясь, выберите характеристику: пока вы находитесь в этом обличье, вы получаете +1 "
            "на все броски с этой характеристикой. Ведущий, в свою очередь, тоже выбирает одну из ваших "
            "характеристик: вы получаете −1 на все броски с ней, пока находитесь в этом обличье."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_lord_of_elements",
        title="Властелин стихий",
        kind="advanced",
        available_stats=["wis"],
        summary="Призыв духов огня, воды, земли или воздуха.",
        trigger="Когда вы взываете к духам стихий огня, воды, земли или воздуха, чтобы они исполнили ваше поручение...",
        effect="Брось +WIS.",
        effect_10_plus=(
            "Выберите два варианта: духи исполняют вашу просьбу; вы не платите цену, которую требует "
            "Природа; вы сохраняете контроль."
        ),
        effect_7_9=(
            "Выберите один вариант: духи исполняют вашу просьбу; вы не платите цену, которую требует "
            "Природа; вы сохраняете контроль."
        ),
        effect_6_minus="Ваш призыв оборачивается каким-либо катаклизмом.",
    ),
    Move(
        id="druid_equilibrium",
        title="Равновесие",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Нанося урон, копите равновесие для исцеления.",
        trigger="",
        effect=(
            "Когда вы наносите урон, вы получаете равновесие 1. Касаясь кого-то и взывая к духам жизни, "
            "вы можете потратить равновесие, чтобы исцелить цель. Каждая единица равновесия позволяет "
            "исцелить 1к4 ОЗ."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_multiclass_dabbler",
        title="Мультикласс: дилетант",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Дополнительный ход другого класса.",
        trigger="",
        effect=MULTICLASS_EFFECT_TEXT,
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
    Move(
        id="druid_formless",
        title="Свободный от обличий",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Дополнительный запас при превращении.",
        trigger="",
        effect="Когда вы превращаетесь, бросьте 1к4 и прибавьте это число к запасу.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_doppelganger_dance",
        title="Танец двойника",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Постижение сущности людей и гуманоидов для их облика.",
        trigger="",
        effect=(
            "Вы можете постигать сущность индивидов — людей, эльфов и других, — чтобы принять их обличье. "
            "Вы можете скрыть свою метку, но тогда получите −1 ко всем броскам, пока не вернётесь в обычный облик."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_blood_and_thunder_6",
        title="Кровь и гром",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Зубы и когти в крови.",
        trigger="",
        effect="В обличье любого опасного животного ваш урон возрастает до к10.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_druids_sleep",
        title="Сон друида",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Один раз обрести связь с новой землёй.",
        trigger="",
        effect=(
            "Взяв этот ход, вы можете создать гармоничную связь с новой землёй, если проведёте там "
            "некоторое время в покое и безопасности. Сделать это можно лишь один раз, и ведущий скажет, "
            "сколько времени это займёт и какова будет цена. С этого момента вы — дитя и этой земли тоже."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_tongue_of_the_world",
        title="Язык мира",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Требует: Голоса неживого.",
        trigger="",
        effect=(
            "Вашему взору доступны лекала, по которым создан мир. Вы можете применять ходы говорить "
            "с духами, постичь сущность, превращение по отношению к первородным элементам: огню, воде, "
            "воздуху и земле."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_hunter_sister",
        title="Сестра ловчего",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Один ход следопыта на вашем листе.",
        trigger="",
        effect="Выберите один ход следопыта.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_shapeshifting_genius",
        title="Гений превращений",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Требует: Мастер превращений.",
        trigger="",
        effect=(
            "Принимая обличье животного, вы можете поднять броню на 1 или повысить наносимый урон на 1к4. "
            "Выберите одно, когда превращаетесь."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_chimera",
        title="Химера",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Облик из частей до трёх животных.",
        trigger="",
        effect=(
            "Вы можете принять обличье существа, состоящего из частей тела разных животных (до трёх). "
            "Например, медведя с орлиными крыльями и головой барана. Части каждого животного дают вам "
            "особый ход. В остальном химера подчиняется тем же правилам, что другие облики."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="druid_weather_control",
        title="Власть над погодой",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="На рассвете под открытым небом задаёте погоду дня.",
        trigger="",
        effect=(
            "Если на восходе персонаж находится под открытым небом, ведущий спросит вас, какая сегодня "
            "будет погода. Ответьте, и сказанное сбудется."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
]


druid = Playbook(
    id="druid",
    title="Друид",
    archetype="mystic",
    summary=(
        "Ты принадлежишь старому миру: зверям, ветру, болотам, дубам и луне. "
        "Цивилизация приходит и уходит, а земля остаётся с тобой."
    ),
    base_hp=6,
    base_load=6,
    damage_die="d6",
    starting_moves=[
        "druid_born_of_the_soil",
        "druid_by_nature_sustained",
        "druid_spirit_tongue",
        "druid_shapeshifter",
    ],
    advanced_moves=[
        "druid_hunter_brother",
        "druid_teeth_and_claws",
        "druid_spirit_whispers",
        "druid_bark_skin",
        "druid_tigers_eye",
        "druid_shelter",
        "druid_voice_of_the_unliving",
        "druid_shapeshifter_master",
        "druid_lord_of_elements",
        "druid_equilibrium",
        "druid_multiclass_dabbler",
    ],
    advanced_moves_6_10=[
        "druid_formless",
        "druid_doppelganger_dance",
        "druid_blood_and_thunder_6",
        "druid_druids_sleep",
        "druid_tongue_of_the_world",
        "druid_hunter_sister",
        "druid_shapeshifting_genius",
        "druid_chimera",
        "druid_weather_control",
    ],
)
