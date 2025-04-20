from django import forms
import json
from game_manager.models import (
    SkillGroup, Skill, GameItem, NPC, SceneMap, Location, 
    PlayerCharacter, StatHolder, StatValue, WhereObject, GlobalSession,
    PlayerAction, MapObjectPolygon, GameEvent, Note
)


class StatValueForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['initial_value'].widget.attrs.update({
            'class': 'form-control initial-value',
            'onchange': 'updateCurrentValue(this)'
        })

    class Meta:
        model = StatValue
        fields = ['skill', 'initial_value', 'current_value', 'is_requirement']
        widgets = {
            'skill': forms.Select(attrs={'class': 'form-control'}),
            'initial_value': forms.NumberInput(attrs={'class': 'form-control'}),
            'current_value': forms.NumberInput(attrs={'class': 'form-control'}),
            'is_requirement': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }
