from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *

class SkillGroupListView(ListView):
    model = SkillGroup
    context_object_name = 'skill_groups'
    template_name = 'game_manager/skillgroup/list.html'

class SkillGroupCreateView(CreateView):
    model = SkillGroup
    form_class = SkillGroupForm
    template_name = 'game_manager/skillgroup/form.html'
    success_url = reverse_lazy('skillgroup_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание группы навыков'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Группа навыков успешно создана.')
        return super().form_valid(form)

class SkillGroupDetailView(DetailView):
    model = SkillGroup
    context_object_name = 'skillgroup'
    template_name = 'game_manager/skillgroup/detail.html'

class SkillGroupUpdateView(UpdateView):
    model = SkillGroup
    form_class = SkillGroupForm
    template_name = 'game_manager/skillgroup/form.html'
    success_url = reverse_lazy('skillgroup_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование группы навыков'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Группа навыков успешно обновлена.')
        return super().form_valid(form)

class SkillGroupDeleteView(DeleteView):
    model = SkillGroup
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('skillgroup_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление группы навыков'
        context['message'] = f'Вы уверены, что хотите удалить группу навыков "{self.object.name}"?'
        return context
    
    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Группа навыков успешно удалена.')
        return super().delete(request, *args, **kwargs)