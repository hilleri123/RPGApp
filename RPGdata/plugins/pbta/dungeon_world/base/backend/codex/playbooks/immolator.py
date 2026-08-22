from __future__ import annotations

from plugins.pbta.base.backend.types import Move, MoveGrantResource, Playbook


immolator_moves: list[Move] = [
    Move(
        id="immolator_brand_of_fire",
        title="Огненное клеймо",
        kind="class",
        available_stats=["con"],
        summary="Создаёте оружие из чистого пламени.",
        trigger="Когда вы создаёте оружие из чистого пламени...",
        effect="Брось +CON.",
        effect_10_plus=(
            "Выберите два свойства из списка. Можете использовать INT вместо STR или DEX "
            "для атак этим оружием. У оружия всегда есть свойства: огненный, касание, опасный, запас 3. "
            "Каждая атака отнимает один запас. Варианты: рука; +1 к урону; метательное, близко; "
            "удалите свойство опасный."
        ),
        effect_7_9="Выберите одно свойство из того же списка.",
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="immolator_clash_of_blades",
        title="Клин клином",
        kind="class",
        available_stats=[],
        requires_roll=True,
        summary="Внутренний огонь отражает урон или подпитывает клеймо.",
        trigger="Когда вам причинили урон (после вычета брони)...",
        effect="Бросьте 1d4.",
        effect_10_plus=(
            "Либо добавьте результат к запасу огненного клейма (если активно), "
            "либо отнимите результат от урона."
        ),
        effect_7_9="То же, что на 10+.",
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="immolator_give_me_fire",
        title="Дай огня",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Взглядом вытягиваете правду о желаниях.",
        trigger="Когда вы пристально смотрите кому-то в глаза...",
        effect=(
            "Спросите у игрока, отвечающего за этого персонажа: «Что питает огонь твоих желаний?» "
            "Игрок (или мастер) должен ответить честно, даже если персонаж сам не осознаёт ответа "
            "или пытался его скрыть."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="immolator_zuko_style",
        title="Стиль Зуко",
        kind="class",
        available_stats=["wis"],
        summary="Пламя подчиняется вашей воле.",
        trigger="Когда вы подчиняете пламя своей воле...",
        effect="Брось +WIS.",
        effect_10_plus=(
            "Оно подчиняется, принимая угодную вам форму, и двигается согласно вашему желанию, "
            "пока есть топливо для горения."
        ),
        effect_7_9="Пламя горит лишь несколько мгновений.",
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="immolator_hand_crafting",
        title="Ручное изготовление",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Огнём и руками создаёте металлические вещи.",
        trigger="",
        effect=(
            "Вы можете использовать руки вместо инструментов и огнём создавать металлические объекты. "
            "Обычное оружие и броня, украшения — всему можно придать форму. "
            "Вы также можете расплавить эти вещи, но без спокойной обстановки, возможно, "
            "придётся спастись от угрозы."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="immolator_wisdom_of_flame",
        title="Мудрость пламени",
        kind="advanced",
        available_stats=["wis"],
        summary="Огонь подсказывает ответы о ситуации.",
        trigger="Когда вы пристально смотрите в огонь в поисках ответов...",
        effect="Брось +WIS.",
        effect_10_plus=(
            "Мастер расскажет что-то новое и интересное о текущей ситуации в деталях. "
            "Если вы уже знаете всё возможное — скажет об этом."
        ),
        effect_7_9="Мастер даст общее представление.",
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="immolator_burns_twice_as_bright",
        title="Горит вдвое ярче",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Жертвуете частью себя, чтобы спасти бросок.",
        trigger="",
        effect=(
            "Когда вы источаете огни судьбы, можете считать проваленный бросок за 7–9, "
            "а если результат был 7–9 — как будто это 10+. "
            "Скажите мастеру, чего вы за это лишились: эмоций, воспоминания, частички себя. "
            "Нельзя использовать снова, пока не будет использован ход «Сгорает вдвое быстрее»."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="immolator_burns_twice_as_fast",
        title="Сгорает вдвое быстрее",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Получаете вместе с «Горит вдвое ярче».",
        trigger="",
        effect=(
            "Когда вы жертвуете победой в уплату огням судьбы, примите любой успешный бросок "
            "с результатом 10+ как провал."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="immolator_all_consuming_flame",
        title="Всепожирающее пламя",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Больше вариантов для огненного клейма.",
        trigger="",
        effect=(
            "Добавьте следующие свойства как варианты выбора при использовании огненного клейма: "
            "мощное, месиво, удар копья, близко, далеко."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="immolator_stoke_interest",
        title="Подогревать интерес",
        kind="advanced",
        available_stats=["cha"],
        summary="Заражаете NPC новой идеей.",
        trigger="Когда вы представляете новую идею персонажу мастера...",
        effect="Брось +CHA.",
        effect_10_plus="Он поверит и заразится идеей.",
        effect_7_9="Его пыл утихнет через день или два.",
        effect_6_minus="Он открыто высказывает своё негодование.",
    ),
    Move(
        id="immolator_ogdru_jahad",
        title="Огдру Джахад",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Получаете ход волшебника «Ритуал».",
        trigger="",
        effect=(
            "Получите ход волшебника «Ритуал». Мастер всегда будет говорить, "
            "что нужно принести в жертву, чтобы получить желаемый эффект."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="immolator_moth_to_flame",
        title="Как мотылёк на огонь",
        kind="advanced",
        available_stats=["wis"],
        summary="Подавляете слабый разум внутренним пламенем.",
        trigger="Когда вы подавляете слабый разум своим внутренним пламенем...",
        effect="Брось +WIS.",
        effect_10_plus=(
            "Воля цели подавлена: она последует за вами и сделает, что вы скажете, "
            "пока что-то её не напугает или не застанет врасплох."
        ),
        effect_7_9="Эффекта хватит, чтобы отвлечь или сбить с толку.",
        effect_6_minus="Цель взволнована; ваш огонь зажёг искры её скрытых желаний.",
    ),
    Move(
        id="immolator_burning_bridges",
        title="Сжигая мосты",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Стереть уз, чтобы избежать последнего вздоха.",
        trigger="Когда вы должны совершить последний вздох...",
        effect=(
            "Вместо этого можете стереть одну из ваших уз — навсегда уменьшая максимум уз. "
            "Вы живы с 1d6 ОЗ. Если уз не осталось — делайте последний вздох по обычным правилам."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="immolator_kindling",
        title="Возжигатель",
        kind="advanced",
        available_stats=["cha"],
        summary="Воодушевляете других на храбрость.",
        trigger="Когда вы воодушевляете других на храбрые действия...",
        effect="Брось +CHA.",
        effect_10_plus="Они лишаются страха и сомнения, моментально набираясь храбрости.",
        effect_7_9="Эффект не продержится долго — захотят отступить через пару мгновений.",
        effect_6_minus="Они напуганы вашим присутствием.",
    ),
    Move(
        id="immolator_painful_burn",
        title="Болезненный ожог",
        kind="advanced",
        available_stats=["cha"],
        summary="Оскорбление, которое нельзя проигнорировать.",
        trigger="Когда вы оскорбляете персонажа мастера...",
        effect="Брось +CHA.",
        effect_10_plus="Он проглатывает оскорбление, как и осуждение окружающих.",
        effect_7_9="Вы перешли черту — когда-нибудь он отомстит.",
        effect_6_minus="Вы зашли слишком далеко и нарвались на проблемы здесь и сейчас.",
    ),
    Move(
        id="immolator_hellfire",
        title="Адское пламя",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Чёрное пламя выжигает душу.",
        trigger="",
        effect=(
            "Когда вы создаёте огонь любым своим ходом, можете по желанию заменить его на чёрное пламя "
            "из глубин ада. Оно не обжигает жаром, а выжигает душу, игнорируя броню. "
            "Бездушным существам нельзя нанести вред этим пламенем."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="immolator_blazing_ring",
        title="Пылающее кольцо",
        kind="advanced",
        available_stats=["cha"],
        summary="Связь через пламя с согласным союзником.",
        trigger="Когда вы подпитываете согласного персонажа силой вашего пламени...",
        effect="Брось +CHA.",
        effect_10_plus=(
            "Вы связаны: чувствуете друг друга и делитесь эмоциями на любом расстоянии. "
            "Стираете все узы между вами; новые можно записать в конце сессии."
        ),
        effect_7_9=(
            "Связь нестабильна: если один получает травму, её получает другой (и наоборот)."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="immolator_play_with_fire",
        title="Играть с огнём",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет «Подогревать интерес».",
        trigger="",
        effect="Вы можете подогревать интерес группы людей — с десяток или около того.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="immolator_burn_it_all",
        title="Гори оно всё огнём",
        kind="advanced",
        available_stats=["wis"],
        summary="Огненный шторм с брешью на огненный план.",
        trigger="Когда вы открываете брешь на огненный план и вызываете из его недр бурю...",
        effect=(
            "Скажите мастеру, чем вы жертвуете, и бросьте +WIS. "
            "Небосвод низвергает огненный дождь на область, сопоставимую с маленькой деревней."
        ),
        effect_10_plus="Вы в любой момент можете прекратить шторм.",
        effect_7_9="Огонь вырывается из-под контроля и распространяется ветрами.",
        effect_6_minus="Нечто злое, разумное и голодное высвобождается вместе с штормом.",
    ),
]


immolator = Playbook(
    id="immolator",
    title="Испепелитель",
    archetype="mystic",
    summary=(
        "Живое пламя в человеческой оболочке. "
        "Ты жертвуешь, творишь из огня и заставляешь других заглянуть в собственные желания."
    ),
    base_hp=4,
    base_load=9,
    damage_die="d8",
    starting_moves=[m.id for m in immolator_moves if m.kind == "class"],
    advanced_moves=[
        "immolator_wisdom_of_flame",
        "immolator_burns_twice_as_bright",
        "immolator_burns_twice_as_fast",
        "immolator_all_consuming_flame",
        "immolator_stoke_interest",
        "immolator_ogdru_jahad",
        "immolator_moth_to_flame",
        "immolator_burning_bridges",
        "immolator_kindling",
        "immolator_painful_burn",
    ],
    advanced_moves_6_10=[
        "immolator_hellfire",
        "immolator_blazing_ring",
        "immolator_play_with_fire",
        "immolator_burn_it_all",
    ],
)
