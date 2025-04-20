from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *




class GameItemListView(ListView):
    model = GameItem
    context_object_name = 'gameitems'
    template_name = 'game_manager/gameitem/list.html'

class GameItemCreateView(CreateView):
    model = GameItem
    form_class = GameItemForm
    template_name = 'game_manager/gameitem/form.html'
    success_url = reverse_lazy('gameitem_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание предмета'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Предмет успешно создан.')
        return super().form_valid(form)

class GameItemDetailView(DetailView):
    model = GameItem
    context_object_name = 'gameitem'
    template_name = 'game_manager/gameitem/detail.html'

class GameItemUpdateView(UpdateView):
    model = GameItem
    form_class = GameItemForm
    template_name = 'game_manager/gameitem/form.html'
    success_url = reverse_lazy('gameitem_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование предмета'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Предмет успешно обновлен.')
        return super().form_valid(form)

class GameItemDeleteView(DeleteView):
    model = GameItem
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('gameitem_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление предмета'
        context['message'] = f'Вы уверены, что хотите удалить предмет "{self.object.name}"?'
        return context
    
    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Предмет успешно удален.')
        return super().delete(request, *args, **kwargs)