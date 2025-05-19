# game_manager/models.py
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from colorfield.fields import ColorField
import datetime
from game_manager.storage_backends import PublicMediaStorage

class SkillGroup(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Группа навыков"
        verbose_name_plural = "Группы навыков"

class Skill(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название")
    group = models.ForeignKey(SkillGroup, related_name="skills", on_delete=models.CASCADE, verbose_name="Группа")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Навык"
        verbose_name_plural = "Навыки"

class StatHolder(models.Model):
    """Контейнер для хранения набора навыков"""

    name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Название набора")
    
    def __str__(self):
        return f"Навыки: {self.name or self.content_object}"
    
    class Meta:
        verbose_name = "Набор навыков"
        verbose_name_plural = "Наборы навыков"

class StatValue(models.Model):
    """Конкретное значение навыка в наборе"""
    stat_holder = models.ForeignKey(StatHolder, on_delete=models.CASCADE, related_name="stat_values")
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, verbose_name="Навык")
    initial_value = models.IntegerField(default=0, verbose_name="Начальное значение") 
    current_value = models.IntegerField(default=0, verbose_name="Текущее значение")
    is_requirement = models.BooleanField(default=False, verbose_name="Является требованием")
    
    class Meta:
        unique_together = ('stat_holder', 'skill')
        verbose_name = "Значение навыка"
        verbose_name_plural = "Значения навыков"
    
    def __str__(self):
        return f"{self.skill.name}: {self.current_value}"

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
    leads_to = models.ForeignKey(SceneMap, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Ведет к карте")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Локация"
        verbose_name_plural = "Локации"

class PlayerCharacter(models.Model):
    name = models.CharField(max_length=255, verbose_name="Имя")
    path_to_img = models.ImageField(
        upload_to='characters/', 
        storage=PublicMediaStorage(),
        verbose_name="Изображение персонажа"
    )
    short_desc = models.TextField(verbose_name="Краткое описание")
    story = models.TextField(verbose_name="История")
    time = models.DateTimeField(default=datetime.datetime.now, verbose_name="Время")
    color = ColorField(default='#FF0000', verbose_name="Цвет")
    address = models.CharField(max_length=255, verbose_name="Адрес")
    player_locked = models.BooleanField(default=False, verbose_name="Персонаж заблокирован")
    map = models.ForeignKey(SceneMap, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Карта")
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Локация")
    
    stats = models.OneToOneField(
        StatHolder,
        on_delete=models.CASCADE,
        related_name='character',
        verbose_name="Навыки",
        null=True
    )

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.stats:
            stat_holder = StatHolder.objects.create(name=f"Навыки {self.name}")
            self.stats = stat_holder
            super().save(update_fields=['stats'])
            
            # Добавляем все возможные навыки со значениями по умолчанию 0
            for skill in Skill.objects.all():
                StatValue.objects.create(
                    stat_holder=stat_holder,
                    skill=skill,
                    initial_value=0,
                    current_value=0,
                    is_requirement=False
                )

    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Персонаж игрока"
        verbose_name_plural = "Персонажи игроков"

# class Stat(models.Model):
#     character = models.ForeignKey(PlayerCharacter, on_delete=models.CASCADE, verbose_name="Персонаж")
#     skill = models.ForeignKey(Skill, on_delete=models.CASCADE, verbose_name="Навык")
#     init_value = models.IntegerField(default=0, verbose_name="Начальное значение")
#     value = models.IntegerField(default=0, verbose_name="Текущее значение")
    
#     class Meta:
#         unique_together = ('character', 'skill')
#         verbose_name = "Характеристика"
#         verbose_name_plural = "Характеристики"
    
#     def __str__(self):
#         return f"{self.character.name} - {self.skill.name}: {self.value}"

class NPC(models.Model):
    name = models.CharField(max_length=255, verbose_name="Имя")
    path_to_img = models.ImageField(
        upload_to='npcs/',
        storage=PublicMediaStorage(),
        verbose_name="Изображение персонажа"
    )
    is_enemy = models.BooleanField(default=False, verbose_name="Враг")
    description = models.TextField(verbose_name="Описание")
    is_dead = models.BooleanField(default=False, verbose_name="Мёртв")

    @property
    def stats(self):
        """Получение набора навыков NPC"""
        ct = ContentType.objects.get_for_model(self)
        holder, _ = StatHolder.objects.get_or_create(
            content_type=ct, 
            object_id=self.id
        )
        return holder
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "NPC"
        verbose_name_plural = "NPC"


class WhereObject(models.Model):
    game_item = models.OneToOneField(GameItem, on_delete=models.CASCADE, verbose_name="Предмет")
    npc = models.ForeignKey(NPC, on_delete=models.CASCADE, null=True, blank=True, verbose_name="NPC")
    location = models.ForeignKey(Location, on_delete=models.CASCADE, null=True, blank=True, verbose_name="Локация")
    player = models.ForeignKey(PlayerCharacter, on_delete=models.CASCADE, null=True, blank=True, verbose_name="Игрок")
    
    def __str__(self):
        return f"Местонахождение: {self.game_item.name}"
    
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
    is_activated = models.BooleanField(default=False, verbose_name="Активировано")
    need_game_items_json = models.TextField(null=True, blank=True, verbose_name="Требуемые предметы (JSON)")
    add_time_secs = models.IntegerField(null=True, blank=True, verbose_name="Добавочное время (сек)")
    
    @property
    def skill_requirements(self):
        """Получение требований по навыкам для действия"""
        ct = ContentType.objects.get_for_model(self)
        holder, _ = StatHolder.objects.get_or_create(
            content_type=ct, 
            object_id=self.id
        )
        return holder

    def __str__(self):
        return self.description[:50]
    
    class Meta:
        verbose_name = "Действие игрока"
        verbose_name_plural = "Действия игроков"

class MapObjectPolygon(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название")
    map = models.ForeignKey(SceneMap, on_delete=models.CASCADE, verbose_name="Карта")
    location = models.ForeignKey(Location, on_delete=models.CASCADE, verbose_name="Локация")
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
    action = models.ForeignKey(PlayerAction, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Действие")
    
    def __str__(self):
        return self.name or "Безымянная заметка"
    
    class Meta:
        verbose_name = "Заметка"
        verbose_name_plural = "Заметки"
