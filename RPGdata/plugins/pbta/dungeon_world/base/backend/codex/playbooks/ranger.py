from __future__ import annotations

from plugins.pbta.base.backend.types import Move, Playbook
from ..multiclass_options import MULTICLASS_EFFECT_TEXT, MULTICLASS_MOVE_PLACEHOLDERS
from plugins.pbta.base.backend.types.types_classes import MovePlaceholder


ranger_moves: list[Move] = [
    Move(
        id="ranger_hunt_and_track",
        title="Выследить",
        kind="class",
        available_stats=["wis"],
        summary="Идёте по следу и не теряете его, пока добыча не сменит путь или способ движения.",
        trigger="Когда вы идёте по следам существа...",
        effect="Брось +WIS.",
        effect_10_plus=(
            "Вы не теряете след, пока существо заметно не сменит направление или способ передвижения, "
            "и выбираете одно: узнаёте полезную информацию о цели (спросите ведущего); "
            "понимаете, почему след оборвался."
        ),
        effect_7_9=(
            "Вы не теряете след, пока существо заметно не сменит направление или способ передвижения."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="ranger_called_shot",
        title="Снайперский выстрел",
        kind="class",
        available_stats=["dex"],
        summary="Дальняя атака по беззащитной цели — урон или прицельный выстрел по части тела.",
        trigger=(
            "Когда вы атакуете издалека врага, которого застали врасплох или который не может защититься..."
        ),
        effect=(
            "Можете просто нанести урон или, выбрав цель (голова, руки, ноги), сделать бросок и приложить DEX."
        ),
        effect_10_plus=(
            "Голова: как на 7–9, плюс обычный урон. Руки: как на 7–9, плюс обычный урон. "
            "Ноги: как на 7–9, плюс обычный урон."
        ),
        effect_7_9=(
            "Голова: противник оглушён и не придёт в себя ещё несколько мгновений. "
            "Руки: противник роняет то, что держал в руках. "
            "Ноги: противник начинает хромать и передвигается медленнее."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="ranger_animal_companion",
        title="Животное-спутник",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Верный зверь со сверхъестественной связью; настраивается при создании персонажа.",
        trigger="",
        effect=(
            "У вас сверхъестественная связь с верным четвероногим (или крылатым) другом. "
            "Вы не можете говорить с ним напрямую, но оно действует согласно вашим желаниям. "
            "Придумайте имя и вид: волк, пума, медведь, орёл, пёс, ястреб, кот, сова, голубь, крыса, мул. "
            "Выберите характеристики (свирепость, ум, броня, инстинкты), сильные стороны (по числу свирепости), "
            "умения (по числу ума: охота, поиск, разведка, охрана, битва с чудовищами, выступление, труд, путешествия) "
            "и слабости (по числу инстинктов). Животное обучено сражаться с людьми."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_command",
        title="Команда",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Животное-спутник усиливает ваши ходы в своей стихии.",
        trigger="Когда животное-спутник помогает вам в чём-то, что оно умеет...",
        effect=(
            "Если вы вдвоём нападаете на одну цель — добавьте свирепость спутника к вашему урону. "
            "Если идёте по следу — добавьте его ум к вашему броску. "
            "Если получаете урон — добавьте его броню к вашей. "
            "Если изучаете обстановку — добавьте его ум к вашему броску. "
            "Если договариваетесь — добавьте его ум к вашему броску. "
            "Если кто-то мешает вам — добавьте инстинкт спутника к броску мешающего."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_wild_empathy",
        title="Дикая эмпатия",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Разговор с животными и понимание их.",
        trigger="",
        effect="Вы можете говорить с животными и понимать их.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_familiar_prey",
        title="Знакомая добыча",
        kind="advanced",
        available_stats=["wis"],
        summary="Знания о монстрах через память — с МДР, а не ИНТ.",
        trigger="Когда вы копаетесь в памяти в поисках знаний о каком-то монстре...",
        effect="Приложите WIS вместо INT (ход «Покопаться в памяти»).",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_viper_strike",
        title="Укус гадюки",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Два оружия одновременно — дополнительный урон неосновной рукой.",
        trigger="",
        effect=(
            "Если у вас два оружия и вы атакуете противника обоими одновременно, "
            "добавьте 1d4 урона оружием в неосновной руке."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_camouflage",
        title="Маскировка",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="На природе в неподвижности вас не заметят.",
        trigger="",
        effect="Когда вы прячетесь на природе, пока вы неподвижны — вас не заметят.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_friend_of_beast",
        title="Друг человека",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Спутник принимает удар вместо вас; свирепость падает до 0.",
        trigger="",
        effect=(
            "Если вы позволяете животному-спутнику принять удар, предназначенный вам, "
            "никто не получает урона, но свирепость спутника опускается до 0. "
            "Если она уже равна 0, вы не можете использовать этот ход. "
            "Если вы оба отдохнёте несколько часов, свирепость восстановится."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_hail_of_arrows",
        title="Туча стрел",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Залп по нескольким целям за дополнительный боезапас.",
        trigger="",
        effect=(
            "Делая залп (ход «Дать залп»), вы можете потратить дополнительную единицу боезапаса до броска. "
            "За каждую потраченную единицу можете выбрать дополнительную цель. "
            "Бросок хода и бросок урона делаются один раз."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_well_trained",
        title="Хорошо обученный",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Ещё одно умение для животного-спутника.",
        trigger="",
        effect="Выберите ещё одно умение для вашего животного-спутника.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_bird_of_god",
        title="Птица божия",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Божество, молитва и сотворение заклинаний как у жреца 1-го уровня.",
        trigger="",
        effect=(
            "Посвятите себя божеству (возьмите одно из имеющихся или придумайте новое). "
            "Вы получаете жреческие ходы «Причастие» и «Сотворить заклинание»; "
            "по части заклинаний вы, по сути, становитесь жрецом первого уровня. "
            "С каждым новым уровнем ваш уровень жреческих способностей также увеличивается на 1."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_follow_me",
        title="Следуй за мной",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Две роли в опасном путешествии — отдельный бросок на каждую.",
        trigger="",
        effect=(
            "Когда вы отправляетесь в опасное путешествие, вы можете взять две роли. "
            "Каждая требует отдельного броска. "
            "Если вы эльф и держите путь по дикой местности, вы успешно исполняете обе роли — "
            "бонус стартового хода вашей расы."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_safe_camp",
        title="Безопасное место",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Назначая дозор на ночь, все получают +1 к несению дозора.",
        trigger="",
        effect="Когда вы назначаете дозор на ночь, все получают +1 к несению дозора.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_multiclass_dabbler",
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
        id="ranger_wild_tongue",
        title="Дикий язык",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Дикая эмпатия.",
        trigger="",
        effect=(
            "Вы можете разговаривать с любым существом, кроме планарных и волшебных созданий, "
            "и понимать его."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_my_prey",
        title="Моя добыча",
        kind="advanced",
        available_stats=["wis"],
        summary="Заменяет: Знакомая добыча.",
        trigger="Когда вы копаетесь в памяти насчёт знаний о каком-либо монстре...",
        effect="Приложите WIS вместо INT (ход «Покопаться в памяти»).",
        effect_10_plus="На 12+ вы также можете задать ведущему любой вопрос об этом монстре.",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_viper_fangs",
        title="Клыки гадюки",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Укус гадюки.",
        trigger="",
        effect=(
            "Если у вас два оружия и вы атакуете противника обоими одновременно, "
            "добавьте 1d8 урона оружием в неосновной руке."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_smog_scale_gap",
        title="Прореха в чешуе Смога",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Зная уязвимое место, стрелы получают пробивание 2.",
        trigger="",
        effect=(
            "Когда вы знаете уязвимое место цели, ваши стрелы приобретают свойство пробивание 2."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_wanderer",
        title="Странник",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Следуй за мной.",
        trigger="",
        effect=(
            "Когда вы отправляетесь в опасное путешествие, вы можете взять две роли. "
            "Сделайте по два броска на каждую и выберите лучший результат в каждом случае."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_really_safe_camp",
        title="Действительно безопасное место",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Безопасное место.",
        trigger="",
        effect=(
            "Когда вы назначаете дозор на ночь, все получают +1 к несению дозора. "
            "После ночи в лагере, где вы назначали дозор, все получают +1 вперёд на следующий ход."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_watcher",
        title="Наблюдатель",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="После успешного выслеживания — вопрос из списка «Изучить обстановку».",
        trigger="",
        effect=(
            "Когда вы предпринимаете успешную попытку выследить кого-то, "
            "можете задать ведущему вопрос об этом существе из списка вопросов хода «Изучить обстановку»."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="ranger_special_trick",
        title="Особый трюк",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Ход другого класса, который можно выполнить вместе со спутником.",
        trigger="",
        effect=(
            "Выберите ход другого класса: {{picked_move}}. "
            "Пока ваше животное-спутник с вами, вы можете совместно выполнить этот ход."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=[
            MovePlaceholder(
                id="picked_move",
                label="Ход другого класса",
                kind="move_pick",
                required=True,
            ),
        ],
    ),
    Move(
        id="ranger_unusual_companion",
        title="Необычный спутник",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Спутник — монстр с усиленными характеристиками.",
        trigger="",
        effect=(
            "Ваш спутник — не обычное животное, а монстр. Опишите его. "
            "Оно получает +2 к свирепости и +1 к инстинкту, плюс новое умение."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
]


ranger = Playbook(
    id="ranger",
    title="Следопыт",
    archetype="combat",
    summary=(
        "Проводник, охотник и дикий зверь. "
        "Ты знаешь тайны пустошей и ведёшь спутников сквозь кровь и мглу."
    ),
    base_hp=8,
    base_load=11,
    damage_die="d8",
    starting_moves=[
        "ranger_hunt_and_track",
        "ranger_called_shot",
        "ranger_animal_companion",
        "ranger_command",
    ],
    advanced_moves=[
        "ranger_wild_empathy",
        "ranger_familiar_prey",
        "ranger_viper_strike",
        "ranger_camouflage",
        "ranger_friend_of_beast",
        "ranger_hail_of_arrows",
        "ranger_well_trained",
        "ranger_bird_of_god",
        "ranger_follow_me",
        "ranger_safe_camp",
        "ranger_multiclass_dabbler",
    ],
    advanced_moves_6_10=[
        "ranger_wild_tongue",
        "ranger_my_prey",
        "ranger_viper_fangs",
        "ranger_smog_scale_gap",
        "ranger_wanderer",
        "ranger_really_safe_camp",
        "ranger_watcher",
        "ranger_special_trick",
        "ranger_unusual_companion",
    ],
)
