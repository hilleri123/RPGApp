from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *





class LocationListView(ListView):
    model = Location
    context_object_name = 'locations'
    template_name = 'game_manager/location/list.html'

class LocationCreateView(CreateView):
    model = Location
    form_class = LocationForm
    template_name = 'game_manager/location/form.html'
    success_url = reverse_lazy('location_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание локации'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Локация успешно создана.')
        return super().form_valid(form)

class LocationDetailView(DetailView):
    model = Location
    context_object_name = 'location'
    template_name = 'game_manager/location/detail.html'

class LocationUpdateView(UpdateView):
    model = Location
    form_class = LocationForm
    template_name = 'game_manager/location/form.html'
    success_url = reverse_lazy('location_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование локации'
        return context
    
    def form_valid(self, form):
        messages.success(self.request, 'Локация успешно обновлена.')
        return super().form_valid(form)

class LocationDeleteView(DeleteView):
    model = Location
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('location_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление локации'
        context['message'] = f'Вы уверены, что хотите удалить локацию "{self.object.name}"?'
        return context
    
    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Локация успешно удалена.')
        return super().delete(request, *args, **kwargs)
