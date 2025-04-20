from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *




class NPCListView(ListView):
    model = NPC
    context_object_name = 'npcs'
    template_name = 'game_manager/npc/list.html'

class NPCCreateView(CreateView):
    model = NPC
    form_class = NPCForm
    template_name = 'game_manager/npc/form.html'
    success_url = reverse_lazy('npc_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание NPC'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'NPC успешно создан.')
        return super().form_valid(form)

class NPCDetailView(DetailView):
    model = NPC
    context_object_name = 'npc'
    template_name = 'game_manager/npc/detail.html'

class NPCUpdateView(UpdateView):
    model = NPC
    form_class = NPCForm
    template_name = 'game_manager/npc/form.html'
    success_url = reverse_lazy('npc_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование NPC'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'NPC успешно обновлен.')
        return super().form_valid(form)

class NPCDeleteView(DeleteView):
    model = NPC
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('npc_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление NPC'
        context['message'] = f'Вы уверены, что хотите удалить NPC "{self.object.name}"?'
        return context
    
    def delete(self, request, *args, **kwargs):
        messages.success(request, 'NPC успешно удален.')
        return super().delete(request, *args, **kwargs)