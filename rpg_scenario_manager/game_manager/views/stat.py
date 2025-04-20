from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *


class StatHolderListView(ListView):
    model = StatHolder
    template_name = 'game_manager/statholder/list.html'
    context_object_name = 'statholders'
    
    def get_queryset(self):
        return StatHolder.objects.select_related('content_type')

class StatHolderDetailView(DetailView):
    model = StatHolder
    template_name = 'game_manager/statholder/detail.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['skill_groups'] = SkillGroup.objects.prefetch_related('skills')
        return context