from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *

def index(request):
    """Главная страница"""
    context = {
        'skill_groups_count': SkillGroup.objects.count(),
        'skills_count': Skill.objects.count(),
        'game_items_count': GameItem.objects.count(),
        'npcs_count': NPC.objects.count(),
        'characters_count': PlayerCharacter.objects.count(),
        'locations_count': Location.objects.count(),
        'maps_count': SceneMap.objects.count(),
        'events_count': GameEvent.objects.count(),
    }
    return render(request, 'index.html', context)