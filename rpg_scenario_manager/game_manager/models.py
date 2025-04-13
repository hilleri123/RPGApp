# game_manager/models.py
from django.db import models
from colorfield.fields import ColorField
import datetime

class SkillGroup(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Группа навыков"
        verbose_name_plural = "Группы навыков"

class Skill(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название")
    group_id = models.ForeignKey(SkillGroup, related_name="skills", on_delete=models.CASCADE, verbose_name="Группа")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Навык"
        verbose_name_plural = "Навыки"

class GameItem(models.Model):
    name = models.CharField(max_length=255, default='', verbose_name="Название")
    text = models.TextField(default='', verbose_name="Описание")
    bonuses_json = models.TextField(default='', verbose_name="Бонусы (JSON)")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Предмет"
        verbose_name_plural = "Предметы"

class SceneMap(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название")
    file_path = models.CharField(max_length=255, verbose_name="Путь к файлу")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Карта сцены"
        verbose_name_plural = "Карты сцен"

class Location(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название")
    description = models.TextField(verbose_name="Описание")
    leads_to_id = models.ForeignKey(SceneMap, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Ведет к карте")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Локация"
        verbose_name_plural = "Локации"

class PlayerCharacter(models.Model):
    name = models.CharField(max_length=255, verbose_name="Имя")
    path_to_img = models.CharField(max_length=255, verbose_name="Путь к изображению")
    short_desc = models.TextField(verbose_name="Краткое описание")
    story = models.TextField(verbose_name="История")
    time = models.DateTimeField(default=datetime.datetime.now, verbose_name="Время")
    color = ColorField(default='#FF0000', verbose_name="Цвет")
    address = models.CharField(max_length=255, verbose_name="Адрес")
    player_locked = models.BooleanField(default=False, verbose_name="Персонаж заблокирован")
    map_id = models.ForeignKey(SceneMap, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Карта")
    location_id = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Локация")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Персонаж игрока"
        verbose_name_plural = "Персонажи игроков"

class Stat(models.Model):
    character_id = models.ForeignKey(PlayerCharacter, on_delete=models.CASCADE, verbose_name="Персонаж")
    skill_id = models.ForeignKey(Skill, on_delete=models.CASCADE, verbose_name="Навык")
    init_value = models.IntegerField(default=0, verbose_name="Начальное значение")
    value = models.IntegerField(default=0, verbose_name="Текущее значение")
    
    class Meta:
        unique_together = ('character_id', 'skill_id')
        verbose_name = "Характеристика"
        verbose_name_plural = "Характеристики"
    
    def __str__(self):
        return f"{self.character_id.name} - {self.skill_id.name}: {self.value}"

class NPC(models.Model):
    name = models.CharField(max_length=255, verbose_name="Имя")
    path_to_img = models.CharField(max_length=255, verbose_name="Путь к изображению")
    is_enemy = models.BooleanField(default=False, verbose_name="Враг")
    skill_ids_json = models.TextField(default='[]', verbose_name="ID навыков (JSON)")
    description = models.TextField(verbose_name="Описание")
    is_dead = models.BooleanField(default=False, verbose_name="Мёртв")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "NPC"
        verbose_name_plural = "NPC"

class WhereObject(models.Model):
    game_item_id = models.OneToOneField(GameItem, on_delete=models.CASCADE, verbose_name="Предмет")
    npc_id = models.ForeignKey(NPC, on_delete=models.CASCADE, null=True, blank=True, verbose_name="NPC")
    location_id = models.ForeignKey(Location, on_delete=models.CASCADE, null=True, blank=True, verbose_name="Локация")
    player_id = models.ForeignKey(PlayerCharacter, on_delete=models.CASCADE, null=True, blank=True, verbose_name="Игрок")
    
    def __str__(self):
        return f"Местонахождение: {self.game_item_id.name}"
    
    class Meta:
        verbose_name = "Местонахождение предмета"
        verbose_name_plural = "Местонахождения предметов"

class GlobalSession(models.Model):
    file_path = models.CharField(max_length=255, verbose_name="Путь к файлу")
    intro = models.TextField(verbose_name="Вступление")
    time = models.DateTimeField(default=datetime.datetime.now, verbose_name="Текущее время")
    start_time = models.DateTimeField(default=datetime.datetime.now, verbose_name="Время начала")
    scenario_name = models.CharField(max_length=255, verbose_name="Название сценария")
    scenario_file_path = models.CharField(max_length=255, verbose_name="Путь к файлу сценария")
    
    def __str__(self):
        return self.scenario_name
    
    class Meta:
        verbose_name = "Глобальная сессия"
        verbose_name_plural = "Глобальные сессии"

class PlayerAction(models.Model):
    description = models.TextField(verbose_name="Описание")
    need_skill_ids_conditions_json = models.TextField(default='[]', verbose_name="Условия навыков (JSON)")
    is_activated = models.BooleanField(default=False, verbose_name="Активировано")
    need_game_item_ids_json = models.TextField(null=True, blank=True, verbose_name="Требуемые предметы (JSON)")
    add_time_secs = models.IntegerField(null=True, blank=True, verbose_name="Добавочное время (сек)")
    
    def __str__(self):
        return self.description[:50]
    
    class Meta:
        verbose_name = "Действие игрока"
        verbose_name_plural = "Действия игроков"

class MapObjectPolygon(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название")
    map_id = models.ForeignKey(SceneMap, on_delete=models.CASCADE, verbose_name="Карта")
    location_id = models.ForeignKey(Location, on_delete=models.CASCADE, verbose_name="Локация")
    is_shown = models.BooleanField(default=False, verbose_name="Отображается")
    is_filled = models.BooleanField(default=False, verbose_name="Заполнен")
    is_line = models.BooleanField(default=False, verbose_name="Линия")
    color = ColorField(default='#FF0000', verbose_name="Цвет")
    polygon_list_json = models.TextField(default='[]', verbose_name="Список координат полигона (JSON)")
    icon_file_path = models.CharField(max_length=255, blank=True, null=True, verbose_name="Путь к иконке")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Объект карты (полигон)"
        verbose_name_plural = "Объекты карты (полигоны)"

class GameEvent(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название")
    xml_text = models.TextField(verbose_name="Текст события (XML)")
    happened = models.BooleanField(default=False, verbose_name="Произошло")
    start_time = models.DateTimeField(null=True, blank=True, verbose_name="Время начала")
    end_time = models.DateTimeField(null=True, blank=True, verbose_name="Время окончания")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Игровое событие"
        verbose_name_plural = "Игровые события"

class Note(models.Model):
    name = models.CharField(max_length=255, default='', verbose_name="Название")
    xml_text = models.TextField(verbose_name="Текст заметки (XML)")
    player_shown_json = models.TextField(default='[]', verbose_name="Показано игрокам (JSON)")
    target_player_shown_json = models.TextField(default='[]', verbose_name="Показано целевым игрокам (JSON)")
    action_id = models.ForeignKey(PlayerAction, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Действие")
    
    def __str__(self):
        return self.name or "Безымянная заметка"
    
    class Meta:
        verbose_name = "Заметка"
        verbose_name_plural = "Заметки"
