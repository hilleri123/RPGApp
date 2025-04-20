from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *

class SkillListView(ListView):
    model = Skill
    context_object_name = 'skills'
    template_name = 'game_manager/skill/list.html'

class SkillCreateView(CreateView):
    model = Skill
    form_class = SkillForm
    template_name = 'game_manager/skill/form.html'
    success_url = reverse_lazy('skill_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание навыка'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Навык успешно создан.')
        return super().form_valid(form)

class SkillDetailView(DetailView):
    model = Skill
    context_object_name = 'skill'
    template_name = 'game_manager/skill/detail.html'

class SkillUpdateView(UpdateView):
    model = Skill
    form_class = SkillForm
    template_name = 'game_manager/skill/form.html'
    success_url = reverse_lazy('skill_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование навыка'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Навык успешно обновлен.')
        return super().form_valid(form)

class SkillDeleteView(DeleteView):
    model = Skill
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('skill_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление навыка'
        context['message'] = f'Вы уверены, что хотите удалить навык "{self.object.name}"?'
        return context
    
    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Навык успешно удален.')
        return super().delete(request, *args, **kwargs)