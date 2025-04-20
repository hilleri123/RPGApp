from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *


# Skill Views


# GameItem Views


# NPC Views


# SceneMap Views


# Location Views

# PlayerCharacter Views


# WhereObject Views
class WhereObjectListView(ListView):
    model = WhereObject
    context_object_name = 'whereobjects'
    template_name = 'game_manager/whereobject/list.html'

class WhereObjectCreateView(CreateView):
    model = WhereObject
    form_class = WhereObjectForm
    template_name = 'game_manager/whereobject/form.html'
    success_url = reverse_lazy('whereobject_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание местоположения предмета'
        return context

class WhereObjectDetailView(DetailView):
    model = WhereObject
    context_object_name = 'whereobject'
    template_name = 'game_manager/whereobject/detail.html'

class WhereObjectUpdateView(UpdateView):
    model = WhereObject
    form_class = WhereObjectForm
    template_name = 'game_manager/whereobject/form.html'
    success_url = reverse_lazy('whereobject_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование местоположения предмета'
        return context

class WhereObjectDeleteView(DeleteView):
    model = WhereObject
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('whereobject_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление местоположения предмета'
        context['message'] = f'Вы уверены, что хотите удалить местоположение предмета "{self.object.game_item.name}"?'
        return context

# GlobalSession Views
class GlobalSessionListView(ListView):
    model = GlobalSession
    context_object_name = 'sessions'
    template_name = 'game_manager/globalsession/list.html'

class GlobalSessionCreateView(CreateView):
    model = GlobalSession
    form_class = GlobalSessionForm
    template_name = 'game_manager/globalsession/form.html'
    success_url = reverse_lazy('globalsession_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание глобальной сессии'
        return context

class GlobalSessionDetailView(DetailView):
    model = GlobalSession
    context_object_name = 'session'
    template_name = 'game_manager/globalsession/detail.html'

class GlobalSessionUpdateView(UpdateView):
    model = GlobalSession
    form_class = GlobalSessionForm
    template_name = 'game_manager/globalsession/form.html'
    success_url = reverse_lazy('globalsession_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование глобальной сессии'
        return context

class GlobalSessionDeleteView(DeleteView):
    model = GlobalSession
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('globalsession_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление глобальной сессии'
        context['message'] = f'Вы уверены, что хотите удалить глобальную сессию "{self.object.scenario_name}"?'
        return context

# PlayerAction Views
class PlayerActionListView(ListView):
    model = PlayerAction
    context_object_name = 'actions'
    template_name = 'game_manager/playeraction/list.html'

class PlayerActionCreateView(CreateView):
    model = PlayerAction
    form_class = PlayerActionForm
    template_name = 'game_manager/playeraction/form.html'
    success_url = reverse_lazy('playeraction_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание действия игрока'
        return context

class PlayerActionDetailView(DetailView):
    model = PlayerAction
    context_object_name = 'action'
    template_name = 'game_manager/playeraction/detail.html'

class PlayerActionUpdateView(UpdateView):
    model = PlayerAction
    form_class = PlayerActionForm
    template_name = 'game_manager/playeraction/form.html'
    success_url = reverse_lazy('playeraction_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование действия игрока'
        return context

class PlayerActionDeleteView(DeleteView):
    model = PlayerAction
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('playeraction_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление действия игрока'
        context['message'] = 'Вы уверены, что хотите удалить это действие игрока?'
        return context

# MapObjectPolygon Views
class MapObjectPolygonListView(ListView):
    model = MapObjectPolygon
    context_object_name = 'mapobjects'
    template_name = 'game_manager/mapobjectpolygon/list.html'

class MapObjectPolygonCreateView(CreateView):
    model = MapObjectPolygon
    form_class = MapObjectPolygonForm
    template_name = 'game_manager/mapobjectpolygon/form.html'
    success_url = reverse_lazy('mapobjectpolygon_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание объекта карты'
        return context

class MapObjectPolygonDetailView(DetailView):
    model = MapObjectPolygon
    context_object_name = 'mapobject'
    template_name = 'game_manager/mapobjectpolygon/detail.html'

class MapObjectPolygonUpdateView(UpdateView):
    model = MapObjectPolygon
    form_class = MapObjectPolygonForm
    template_name = 'game_manager/mapobjectpolygon/form.html'
    success_url = reverse_lazy('mapobjectpolygon_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование объекта карты'
        return context

class MapObjectPolygonDeleteView(DeleteView):
    model = MapObjectPolygon
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('mapobjectpolygon_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление объекта карты'
        context['message'] = f'Вы уверены, что хотите удалить объект карты "{self.object.name}"?'
        return context

# GameEvent Views
class GameEventListView(ListView):
    model = GameEvent
    context_object_name = 'events'
    template_name = 'game_manager/gameevent/list.html'

class GameEventCreateView(CreateView):
    model = GameEvent
    form_class = GameEventForm
    template_name = 'game_manager/gameevent/form.html'
    success_url = reverse_lazy('gameevent_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание игрового события'
        return context

class GameEventDetailView(DetailView):
    model = GameEvent
    context_object_name = 'event'
    template_name = 'game_manager/gameevent/detail.html'

class GameEventUpdateView(UpdateView):
    model = GameEvent
    form_class = GameEventForm
    template_name = 'game_manager/gameevent/form.html'
    success_url = reverse_lazy('gameevent_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование игрового события'
        return context

class GameEventDeleteView(DeleteView):
    model = GameEvent
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('gameevent_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление игрового события'
        context['message'] = f'Вы уверены, что хотите удалить игровое событие "{self.object.name}"?'
        return context

# Note Views
class NoteListView(ListView):
    model = Note
    context_object_name = 'notes'
    template_name = 'game_manager/note/list.html'

class NoteCreateView(CreateView):
    model = Note
    form_class = NoteForm
    template_name = 'game_manager/note/form.html'
    success_url = reverse_lazy('note_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание заметки'
        return context

class NoteDetailView(DetailView):
    model = Note
    context_object_name = 'note'
    template_name = 'game_manager/note/detail.html'

class NoteUpdateView(UpdateView):
    model = Note
    form_class = NoteForm
    template_name = 'game_manager/note/form.html'
    success_url = reverse_lazy('note_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование заметки'
        return context

class NoteDeleteView(DeleteView):
    model = Note
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('note_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление заметки'
        context['message'] = f'Вы уверены, что хотите удалить заметку "{self.object.name}"?'
        return context
