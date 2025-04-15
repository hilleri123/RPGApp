from django import forms
import json
from .models import (
    SkillGroup, Skill, GameItem, NPC, SceneMap, Location, 
    PlayerCharacter, StatHolder, StatValue, WhereObject, GlobalSession,
    PlayerAction, MapObjectPolygon, GameEvent, Note
)

class JSONFieldForm(forms.ModelForm):
    """Базовый класс для форм с JSON-полями"""
    def clean_json_field(self, field_name, json_field_name):
        data = self.cleaned_data[field_name]
        if not data:
            return '{}'
        try:
            json.loads(data)
            return data
        except json.JSONDecodeError:
            raise forms.ValidationError(f"Некорректный формат JSON в поле {json_field_name}")

class SkillGroupForm(forms.ModelForm):
    class Meta:
        model = SkillGroup
        fields = ['name']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'})
        }

class SkillForm(forms.ModelForm):
    class Meta:
        model = Skill
        fields = ['name', 'group']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'group': forms.Select(attrs={'class': 'form-control'})
        }

class GameItemForm(JSONFieldForm):
    bonuses = forms.CharField(widget=forms.Textarea(attrs={'rows': 5, 'class': 'form-control'}), 
                            required=False, help_text='Введите бонусы в формате JSON')
    
    class Meta:
        model = GameItem
        fields = ['name', 'text']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'text': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'})
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and self.instance.bonuses_json:
            try:
                self.fields['bonuses'].initial = json.dumps(json.loads(self.instance.bonuses_json), indent=2)
            except:
                self.fields['bonuses'].initial = self.instance.bonuses_json
    
    def clean_bonuses(self):
        return self.clean_json_field('bonuses', 'bonuses_json')
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.bonuses_json = self.cleaned_data['bonuses']
        if commit:
            instance.save()
        return instance

class NPCForm(JSONFieldForm):
    skills = forms.CharField(widget=forms.Textarea(attrs={'rows': 5, 'class': 'form-control'}), 
                             required=False, help_text='Введите ID навыков в формате JSON')
    
    class Meta:
        model = NPC
        fields = ['name', 'path_to_img', 'is_enemy', 'description', 'is_dead']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'path_to_img': forms.TextInput(attrs={'class': 'form-control'}),
            'is_enemy': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'description': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'}),
            'is_dead': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and self.instance.skills_json:
            try:
                self.fields['skills'].initial = json.dumps(json.loads(self.instance.skills_json), indent=2)
            except:
                self.fields['skills'].initial = self.instance.skills_json
    
    def clean_skills(self):
        return self.clean_json_field('skills', 'skills_json')
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.skills_json = self.cleaned_data['skills']
        if commit:
            instance.save()
        return instance

class SceneMapForm(forms.ModelForm):
    class Meta:
        model = SceneMap
        fields = ['name', 'file_path']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'file_path': forms.TextInput(attrs={'class': 'form-control'})
        }

class LocationForm(forms.ModelForm):
    class Meta:
        model = Location
        fields = ['name', 'description', 'leads_to']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'}),
            'leads_to': forms.Select(attrs={'class': 'form-control'})
        }

class PlayerCharacterForm(forms.ModelForm):
    class Meta:
        model = PlayerCharacter
        fields = ['name', 'path_to_img', 'short_desc', 'story', 'time', 'color', 
                  'address', 'player_locked', 'map', 'location']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'path_to_img': forms.TextInput(attrs={'class': 'form-control'}),
            'short_desc': forms.Textarea(attrs={'rows': 3, 'class': 'form-control'}),
            'story': forms.Textarea(attrs={'rows': 6, 'class': 'form-control'}),
            'time': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
            'color': forms.TextInput(attrs={'class': 'form-control', 'type': 'color'}),
            'address': forms.TextInput(attrs={'class': 'form-control'}),
            'player_locked': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'map': forms.Select(attrs={'class': 'form-control'}),
            'location': forms.Select(attrs={'class': 'form-control'})
        }

class StatValueForm(forms.ModelForm):
    class Meta:
        model = StatValue
        fields = ['skill', 'current_value', 'is_requirement']
        widgets = {
            'skill': forms.Select(attrs={'class': 'form-control'}),
            'current_value': forms.NumberInput(attrs={'class': 'form-control', 'min': 0, 'max': 100}),
            'is_requirement': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }

StatValueFormSet = forms.inlineformset_factory(
    StatHolder, StatValue, 
    form=StatValueForm, 
    extra=1, can_delete=True
)

class WhereObjectForm(forms.ModelForm):
    class Meta:
        model = WhereObject
        fields = ['game_item', 'npc', 'location', 'player']
        widgets = {
            'game_item': forms.Select(attrs={'class': 'form-control'}),
            'npc': forms.Select(attrs={'class': 'form-control'}),
            'location': forms.Select(attrs={'class': 'form-control'}),
            'player': forms.Select(attrs={'class': 'form-control'})
        }

class GlobalSessionForm(forms.ModelForm):
    class Meta:
        model = GlobalSession
        fields = ['file_path', 'intro', 'time', 'start_time', 'scenario_name', 'scenario_file_path']
        widgets = {
            'file_path': forms.TextInput(attrs={'class': 'form-control'}),
            'intro': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'}),
            'time': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
            'start_time': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
            'scenario_name': forms.TextInput(attrs={'class': 'form-control'}),
            'scenario_file_path': forms.TextInput(attrs={'class': 'form-control'})
        }

class PlayerActionForm(JSONFieldForm):
    skill_conditions = forms.CharField(widget=forms.Textarea(attrs={'rows': 5, 'class': 'form-control'}),
                              required=False, help_text='Условия навыков в формате JSON')
    need_items = forms.CharField(widget=forms.Textarea(attrs={'rows': 5, 'class': 'form-control'}),
                       required=False, help_text='Требуемые предметы в формате JSON')
    
    class Meta:
        model = PlayerAction
        fields = ['description', 'is_activated', 'add_time_secs']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'}),
            'is_activated': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'add_time_secs': forms.NumberInput(attrs={'class': 'form-control'})
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            if self.instance.need_skills_conditions_json:
                try:
                    self.fields['skill_conditions'].initial = json.dumps(
                        json.loads(self.instance.need_skills_conditions_json), indent=2)
                except:
                    self.fields['skill_conditions'].initial = self.instance.need_skills_conditions_json
            
            if self.instance.need_game_items_json:
                try:
                    self.fields['need_items'].initial = json.dumps(
                        json.loads(self.instance.need_game_items_json), indent=2)
                except:
                    self.fields['need_items'].initial = self.instance.need_game_items_json
    
    def clean_skill_conditions(self):
        return self.clean_json_field('skill_conditions', 'need_skills_conditions_json')
    
    def clean_need_items(self):
        return self.clean_json_field('need_items', 'need_game_items_json')
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.need_skills_conditions_json = self.cleaned_data['skill_conditions']
        instance.need_game_items_json = self.cleaned_data['need_items']
        if commit:
            instance.save()
        return instance

class MapObjectPolygonForm(JSONFieldForm):
    polygon_list = forms.CharField(widget=forms.Textarea(attrs={'rows': 5, 'class': 'form-control'}),
                          required=False, help_text='Список координат полигона в формате JSON')
    
    class Meta:
        model = MapObjectPolygon
        fields = ['name', 'map', 'location', 'is_shown', 'is_filled', 
                  'is_line', 'color', 'icon_file_path']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'map': forms.Select(attrs={'class': 'form-control'}),
            'location': forms.Select(attrs={'class': 'form-control'}),
            'is_shown': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'is_filled': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'is_line': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'color': forms.TextInput(attrs={'class': 'form-control', 'type': 'color'}),
            'icon_file_path': forms.TextInput(attrs={'class': 'form-control'})
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and self.instance.polygon_list_json:
            try:
                self.fields['polygon_list'].initial = json.dumps(
                    json.loads(self.instance.polygon_list_json), indent=2)
            except:
                self.fields['polygon_list'].initial = self.instance.polygon_list_json
    
    def clean_polygon_list(self):
        return self.clean_json_field('polygon_list', 'polygon_list_json')
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.polygon_list_json = self.cleaned_data['polygon_list']
        if commit:
            instance.save()
        return instance

class GameEventForm(forms.ModelForm):
    class Meta:
        model = GameEvent
        fields = ['name', 'xml_text', 'happened', 'start_time', 'end_time']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'xml_text': forms.Textarea(attrs={'rows': 8, 'class': 'form-control'}),
            'happened': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'start_time': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
            'end_time': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'})
        }

class NoteForm(JSONFieldForm):
    player_shown = forms.CharField(widget=forms.Textarea(attrs={'rows': 5, 'class': 'form-control'}),
                          required=False, help_text='Список ID игроков, которым показана заметка')
    target_player_shown = forms.CharField(widget=forms.Textarea(attrs={'rows': 5, 'class': 'form-control'}),
                                 required=False, help_text='Список ID целевых игроков')
    
    class Meta:
        model = Note
        fields = ['name', 'xml_text', 'action']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'xml_text': forms.Textarea(attrs={'rows': 8, 'class': 'form-control'}),
            'action': forms.Select(attrs={'class': 'form-control'})
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            if self.instance.player_shown_json:
                try:
                    self.fields['player_shown'].initial = json.dumps(
                        json.loads(self.instance.player_shown_json), indent=2)
                except:
                    self.fields['player_shown'].initial = self.instance.player_shown_json
            
            if self.instance.target_player_shown_json:
                try:
                    self.fields['target_player_shown'].initial = json.dumps(
                        json.loads(self.instance.target_player_shown_json), indent=2)
                except:
                    self.fields['target_player_shown'].initial = self.instance.target_player_shown_json
    
    def clean_player_shown(self):
        return self.clean_json_field('player_shown', 'player_shown_json')
    
    def clean_target_player_shown(self):
        return self.clean_json_field('target_player_shown', 'target_player_shown_json')
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.player_shown_json = self.cleaned_data['player_shown']
        instance.target_player_shown_json = self.cleaned_data['target_player_shown']
        if commit:
            instance.save()
        return instance
