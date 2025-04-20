from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *




class SceneMapListView(ListView):
    model = SceneMap
    context_object_name = 'scenemaps'
    template_name = 'game_manager/scenemap/list.html'

class SceneMapCreateView(CreateView):
    model = SceneMap
    form_class = SceneMapForm
    template_name = 'game_manager/scenemap/form.html'
    success_url = reverse_lazy('scenemap_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание карты сцены'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Карта сцены успешно создана.')
        return super().form_valid(form)

class SceneMapDetailView(DetailView):
    model = SceneMap
    context_object_name = 'scenemap'
    template_name = 'game_manager/scenemap/detail.html'

class SceneMapUpdateView(UpdateView):
    model = SceneMap
    form_class = SceneMapForm
    template_name = 'game_manager/scenemap/form.html'
    success_url = reverse_lazy('scenemap_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование карты сцены'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Карта сцены успешно обновлена.')
        return super().form_valid(form)

class SceneMapDeleteView(DeleteView):
    model = SceneMap
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('scenemap_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление карты сцены'
        context['message'] = f'Вы уверены, что хотите удалить карту сцены "{self.object.name}"?'
        return context
    
    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Карта сцены успешно удалена.')
        return super().delete(request, *args, **kwargs)