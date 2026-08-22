from __future__ import annotations

from plugins.pbta.base.backend.types import Move, Playbook
from ..multiclass_options import MULTICLASS_EFFECT_TEXT, MULTICLASS_MOVE_PLACEHOLDERS


barbarian_moves: list[Move] = [
    # Стартовые ходы (ход расы «Чужеземец» — в dw_race_moves)

    Move(
        id="barbarian_unbowed_unbent_unbroken",
        title="Непреклонный и неуязвимый",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="+1 к броне, если вы без доспехов, щита и не перегружены.",
        trigger="Если вы не перегружены и не носите доспехи или щит...",
        effect="Добавьте +1 брони.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_heavy_armor",
        title="Закован по уши в доспехи",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Вы игнорируете свойство неудобные у доспехов.",
        trigger="Всегда, когда вы носите доспехи с свойством «неудобные»...",
        effect="Вы игнорируете свойство неудобные у доспехов.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_master_of_fate",
        title="Хозяин положения",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="+1 к броску последнего вздоха и особая сделка со Смертью.",
        trigger="Когда вы совершаете последний вздох...",
        effect=(
            "Вы получаете +1 на бросок последнего вздоха. "
            "На 7–9 вы предлагаете сделку Смерти за вашу жизнь, и если она принимает предложение, "
            "вы возвращаетесь к жизни. Если нет — вы умираете."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_mountain_of_muscle",
        title="Гора мышц",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Ваше оружие становится мощным и оставляет месиво.",
        trigger="Когда вы используете оружие...",
        effect="Оно приобретает свойства мощное и месиво.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_what_are_you_waiting_for",
        title="Чего же ты ждешь?",
        kind="class",
        available_stats=["con"],
        summary="Вы бросаете вызов врагам и становитесь для них главной угрозой.",
        trigger="Когда вы бросаете вызов своим врагам...",
        effect="Бросьте +ТЕЛ.",
        effect_10_plus=(
            "Они видят в вас главную угрозу и будут игнорировать ваших компаньонов, "
            "а вы получаете постоянный +2 к урону по этим врагам."
        ),
        effect_7_9=(
            "Только часть ваших врагов (самые слабые или безрассудные) поддаются вашей провокации."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="barbarian_herculean_appetites",
        title="Геркулесовы аппетиты",
        kind="class",
        available_stats=[],
        requires_roll=False,
        summary="Вы выбираете два аппетита; при погоне за их удовлетворением бросаете 1к6+1к8 вместо 2к6.",
        trigger="Когда вы преследуете цель, способную утолить один из ваших аппетитов...",
        effect=(
            "Выберите из списка два пункта, которых вы жаждете. "
            "Когда вы преследуете цель, способную утолить один из ваших аппетитов, "
            "во время бросков ходов вместо 2к6 используйте 1к6+1к8. "
            "Если результат на к6 выше, чем на к8, ведущий предоставит осложнение или опасность, "
            "которая появилась на пути ваших необдуманных стремлений.\n"
            "• Завоевания\n"
            "• Чистое разрушение\n"
            "• Власть над другими\n"
            "• Богатство и имущество\n"
            "• Триумф и слава\n"
            "• Земные удовольствия"
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),

    # Сложные ходы 2–10

    Move(
        id="barbarian_still_hungry",
        title="Всё ещё голоден",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Выбираете ещё один аппетит.",
        trigger="Когда вы берёте этот ход...",
        effect="Выберите ещё один аппетит.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_thirst_for_destruction",
        title="Жажда разрушения",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Вы берёте ход из буклета воина, барда или вора (не мультикласс).",
        trigger="Когда вы берёте этот ход...",
        effect=(
            "Выберите ход из листа персонажа воина, барда или вора. "
            "Вы не можете брать мультиклассовые ходы из этих буклетов."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
    Move(
        id="barbarian_smashing_impression",
        title="Сногсшибательный эффект",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Проявленная сила даёт бонус к договорённости с свидетелем.",
        trigger="Когда вы проявляете свою силу...",
        effect=(
            "Назовите свидетеля этого события, на которого вы произвели особое впечатление. "
            "Получите +1 на следующую попытку договориться с этим персонажем."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_best_in_life",
        title="Что самое лучшее в жизни?",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="В конце сессии получаете опыт за сокрушение врагов или слух о судьбе их соратников.",
        trigger="В конце сессии...",
        effect=(
            "Отметьте опыт, если во время приключения вы сокрушили врагов, "
            "или до них дошёл слух о горькой судьбе их соратников."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_wide_strides",
        title="Широко шагая",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Вы хорошо знаете мир и местные обычаи.",
        trigger="Когда вы прибываете куда-то...",
        effect=(
            "Спросите ведущего о важных местных традициях, ритуалах и т. д. "
            "Ведущий даст необходимую информацию."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_usurper",
        title="Узурпатор",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Превзойдя человека у власти, вы получаете бонус против его свиты.",
        trigger="Когда вы превосходите чем-то человека у власти...",
        effect=(
            "Получите +1 на следующий бросок против его подчинённых, подпевал и лизоблюдов."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_khan_of_khans",
        title="Хан Ханов",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Ваши наёмники готовы принять удовлетворение аппетита вместо оплаты.",
        trigger="Когда вы нанимаете или платите своим наёмникам...",
        effect="Ваши наёмники готовы принять утоление одного из ваших аппетитов вместо оплаты.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_samson",
        title="Самсон",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Вы можете взять травму, чтобы разорвать оковы.",
        trigger="Когда вам нужно избежать ментальных или физических оков...",
        effect="Вы можете взять травму, чтобы мгновенно избежать ментальных или физических оков.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_smack",
        title="Хрясь!",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="На 12+ при руби и кромсай вы лишаете врага чего-то важного.",
        trigger="Когда вы делаете ход руби и кромсай...",
        effect=(
            "На 12+ нанесите урон и обозначьте что-то, чем физически обладает ваш оппонент "
            "(оружие, позиция, конечность) — он лишится этого."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_insatiable_hunger",
        title="Неутолимый голод",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Вы можете принять постоянный штраф вместо урона, пока не утолите аппетит.",
        trigger="Когда вы получаете урон...",
        effect=(
            "Можете вместо урона выбрать постоянный штраф -1 на броски, пока вы не утолите "
            "один из своих аппетитов. Если у вас уже есть этот штраф, взять его второй раз нельзя."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_sniff_weakness",
        title="Чую слабину",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Вы видите слабые места при изучении обстановки.",
        trigger="Когда вы изучаете обстановку...",
        effect="Добавьте «Что здесь слабое и уязвимое?» к списку вопросов.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_headlong_rush",
        title="Сломя голову",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Вы лучше спасаетесь от опасности, связанной с движением.",
        trigger="Когда вы спасаетесь от угрозы, вызванной движением...",
        effect="Получите +1 на бросок.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),

    # Сложные ходы 6–10

    Move(
        id="barbarian_good_day_to_die",
        title="Хороший день, чтобы умереть",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="+1 на броски при низких ОЗ.",
        trigger="Всегда, когда значение ваших ОЗ меньше значения вашего ТЕЛ (модификатора) или если у вас 1 ОЗ...",
        effect="Получите постоянный +1 на броски.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_knock_them_all_down",
        title="Вали их всех",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Заменяет: Жажда разрушения.",
        trigger="Когда вы берёте этот ход...",
        effect=(
            "Возьмите ещё один ход из листа персонажа воина, барда или вора. "
            "Вы не можете брать мультикласовые ходы из этих буклетов."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
        placeholders=list(MULTICLASS_MOVE_PLACEHOLDERS),
    ),
    Move(
        id="barbarian_battle_cry",
        title="Боевой клич",
        kind="advanced",
        available_stats=["cha"],
        summary="Ваш клич воодушевляет союзников или пугает врагов.",
        trigger="Когда вы вступаете в битву, демонстрируя свою силу...",
        effect="Бросьте +ХАР.",
        effect_10_plus="Получите оба пункта.",
        effect_7_9=(
            "Выберите одно: ваши союзники воодушевлены и получают +1 на следующий бросок; "
            "или ваши враги напуганы и действуют соответствующе (избегают вас, прячутся, атакуют из страха)."
        ),
        effect_6_minus="Мастер делает ход.",
    ),
    Move(
        id="barbarian_symbol_of_power",
        title="Символ могущества",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Вы создаёте личный символ могущества, который внушает уважение.",
        trigger="Когда вы берёте этот ход и беспрепятственно тратите время, предаваясь воспоминаниям о былых победах...",
        effect=(
            "Можете отобразить их величие в личном символе могущества (длинная коса с вплетёнными колокольчиками, "
            "ритуальное шрамирование, татуировки и т. д.). Любой разумный смертный, увидев этот символ, "
            "инстинктивно поймёт, что имеет дело с силой, с которой нужно считаться, и будет относиться к вам соответствующе."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_more_more_more",
        title="Ещё! Мне всё мало!",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Вы можете избавиться от аппетита, удовлетворив его в высшей мере, и выбрать новый.",
        trigger="Когда вы удовлетворяете аппетит в высшей мере...",
        effect=(
            "Можете решить, что избавились от этого аппетита. Вычеркните его из списка и отметьте опыт. "
            "Вы всё так же можете преследовать эти цели, но вас больше не сжигает неутолимая жажда. "
            "Выберите новый аппетит взамен вычеркнутого из списка или придумайте свой."
        ),
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_i_am_the_one_who_knocks",
        title="Я тот, кто стучит",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="На 12+ при спасении от угрозы вы оборачиваете опасность против неё самой.",
        trigger="Когда вы спасаетесь от угрозы...",
        effect="На 12+ оберните опасность против неё самой. Ведущий опишет, как это произошло.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_healthy_mistrust",
        title="Здоровое недоверие",
        kind="advanced",
        available_stats=[],
        requires_roll=False,
        summary="Нечистая магия делает ваши спасброски от угрозы чуть безопаснее.",
        trigger="Когда нечистая магия смертных вынуждает вас спасаться от угрозы...",
        effect="Считайте свой результат 6- как 7-9.",
        effect_10_plus="",
        effect_7_9="",
        effect_6_minus="",
    ),
    Move(
        id="barbarian_blood_for_the_blood_god",
        title="Кровь Богу Крови",
        kind="advanced",
        available_stats=["wis"],
        summary="Жертвоприношения дают видения и преимущества, но могут потребовать вашу плоть.",
        trigger="Когда вы жертвуете ценное для вашего бога во время обряда или ритуала...",
        effect="Бросьте +МДР.",
        effect_10_plus=(
            "Ведущий предоставит вам провидение о текущей проблеме или даст иное преимущество."
        ),
        effect_7_9=(
            "Жертвы недостаточно, и боги возьмут часть вашей плоти в уплату, но также предоставят "
            "провидение или преимущество."
        ),
        effect_6_minus=(
            "Вы вызовете на себя гнев переменчивых божеств."
        ),
    ),
]


barbarian = Playbook(
    id="barbarian",
    title="Варвар",
    archetype="combat",
    summary=(
        "Дикий воин из чужих земель. "
        "Ты живёшь аппетитами, силой и славой, и мир станет либо твоим трофеем, либо руинами."
    ),
    base_hp=8,
    base_load=12,
    damage_die="d10",
    starting_moves=[
        "barbarian_master_of_fate",
        "barbarian_mountain_of_muscle",
        "barbarian_what_are_you_waiting_for",
        "barbarian_herculean_appetites",
    ],
    starting_move_choices=[
        [
            "barbarian_unbowed_unbent_unbroken",
            "barbarian_heavy_armor",
        ],
    ],
    advanced_moves=[
        "barbarian_still_hungry",
        "barbarian_thirst_for_destruction",
        "barbarian_smashing_impression",
        "barbarian_best_in_life",
        "barbarian_wide_strides",
        "barbarian_usurper",
        "barbarian_khan_of_khans",
        "barbarian_samson",
        "barbarian_smack",
        "barbarian_insatiable_hunger",
        "barbarian_sniff_weakness",
        "barbarian_headlong_rush",
    ],
    advanced_moves_6_10=[
        "barbarian_good_day_to_die",
        "barbarian_knock_them_all_down",
        "barbarian_battle_cry",
        "barbarian_symbol_of_power",
        "barbarian_more_more_more",
        "barbarian_i_am_the_one_who_knocks",
        "barbarian_healthy_mistrust",
        "barbarian_blood_for_the_blood_god",
    ],
)