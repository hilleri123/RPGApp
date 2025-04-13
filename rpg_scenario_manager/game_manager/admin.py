# game_manager/admin.py

from django.contrib import admin
from .models import (
    SkillGroup, Skill, GameItem, NPC, SceneMap, Location, 
    PlayerCharacter, Stat, WhereObject, GlobalSession,
    PlayerAction, MapObjectPolygon, GameEvent, Note
)

@admin.register(SkillGroup)
class SkillGroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    search_fields = ['name']

@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'group_id']  # Исправлено с 'group' на 'group_id'
    list_filter = ['group_id']  # Исправлено
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
    list_display = ['id', 'name', 'leads_to_id']  # Исправлено с 'leads_to' на 'leads_to_id'
    list_filter = ['leads_to_id']  # Исправлено
    search_fields = ['name', 'description']

@admin.register(PlayerCharacter)
class PlayerCharacterAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'map_id', 'location_id', 'player_locked']  # Исправлено
    list_filter = ['map_id', 'location_id', 'player_locked']  # Исправлено
    search_fields = ['name', 'short_desc']

@admin.register(Stat)
class StatAdmin(admin.ModelAdmin):
    list_display = ['character_id', 'skill_id', 'init_value', 'value']  # Исправлено
    list_filter = ['character_id', 'skill_id']  # Исправлено

@admin.register(WhereObject)
class WhereObjectAdmin(admin.ModelAdmin):
    list_display = ['id', 'game_item_id', 'npc_id', 'location_id', 'player_id']  # Исправлено
    list_filter = ['location_id', 'npc_id']  # Исправлено

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
    list_display = ['id', 'name', 'map_id', 'location_id', 'is_shown']  # Исправлено
    list_filter = ['map_id', 'location_id', 'is_shown', 'is_filled', 'is_line']  # Исправлено
    search_fields = ['name']

@admin.register(GameEvent)
class GameEventAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'happened', 'start_time', 'end_time']  # Не забудьте использовать 'happened' вместо 'happend'
    list_filter = ['happened']
    search_fields = ['name']

@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'action_id']  # Исправлено с 'action' на 'action_id'
    list_filter = ['action_id']  # Исправлено
    search_fields = ['name', 'xml_text']
