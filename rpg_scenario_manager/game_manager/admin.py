# game_manager/admin.py

from django.contrib import admin
from .models import (
    SkillGroup, Skill, GameItem, NPC, SceneMap, Location, 
    PlayerCharacter, StatHolder, StatValue, WhereObject, GlobalSession,
    PlayerAction, MapObjectPolygon, GameEvent, Note
)

@admin.register(SkillGroup)
class SkillGroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    search_fields = ['name']

@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'group']  # Исправлено с 'group' на 'group'
    list_filter = ['group']  # Исправлено
    search_fields = ['name']

@admin.register(GameItem)
class GameItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    search_fields = ['name', 'text']

@admin.register(NPC)
class NPCAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'is_enemy', 'is_dead']
    list_filter = ['is_enemy', 'is_dead']
    search_fields = ['name', 'description']

@admin.register(SceneMap)
class SceneMapAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'file_path']
    search_fields = ['name']

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'leads_to']  # Исправлено с 'leads_to' на 'leads_to'
    list_filter = ['leads_to']  # Исправлено
    search_fields = ['name', 'description']

@admin.register(PlayerCharacter)
class PlayerCharacterAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'map', 'location', 'player_locked']  # Исправлено
    list_filter = ['map', 'location', 'player_locked']  # Исправлено
    search_fields = ['name', 'short_desc']
    
@admin.register(StatHolder)
class StatHolderAdmin(admin.ModelAdmin):
    list_display = ['id', 'content_type', 'object_id', 'name']
    list_filter = ['content_type']

@admin.register(StatValue)
class StatValueAdmin(admin.ModelAdmin):
    list_display = ['id', 'stat_holder', 'skill', 'initial_value', 'current_value', 'is_requirement']
    list_filter = ['stat_holder', 'skill', 'is_requirement']

@admin.register(WhereObject)
class WhereObjectAdmin(admin.ModelAdmin):
    list_display = ['id', 'game_item', 'npc', 'location', 'player']  # Исправлено
    list_filter = ['location', 'npc']  # Исправлено

@admin.register(GlobalSession)
class GlobalSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'scenario_name', 'time', 'start_time']
    search_fields = ['scenario_name', 'intro']

@admin.register(PlayerAction)
class PlayerActionAdmin(admin.ModelAdmin):
    list_display = ['id', 'description', 'is_activated', 'add_time_secs']
    list_filter = ['is_activated']
    search_fields = ['description']

@admin.register(MapObjectPolygon)
class MapObjectPolygonAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'map', 'location', 'is_shown']  # Исправлено
    list_filter = ['map', 'location', 'is_shown', 'is_filled', 'is_line']  # Исправлено
    search_fields = ['name']

@admin.register(GameEvent)
class GameEventAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'happened', 'start_time', 'end_time']  # Не забудьте использовать 'happened' вместо 'happend'
    list_filter = ['happened']
    search_fields = ['name']

@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'action']  # Исправлено с 'action' на 'action'
    list_filter = ['action']  # Исправлено
    search_fields = ['name', 'xml_text']
