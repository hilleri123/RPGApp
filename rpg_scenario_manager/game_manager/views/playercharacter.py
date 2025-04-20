from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import inlineformset_factory, modelformset_factory
from game_manager.models import *
from game_manager.forms import *





class PlayerCharacterListView(ListView):
    model = PlayerCharacter
    context_object_name = 'characters'
    template_name = 'game_manager/playercharacter/list.html'




class PlayerCharacterDetailView(DetailView):
    model = PlayerCharacter
    context_object_name = 'character'
    template_name = 'game_manager/playercharacter/detail.html'



class PlayerCharacterDeleteView(DeleteView):
    model = PlayerCharacter
    template_name = 'game_manager/confirm_delete.html'
    success_url = reverse_lazy('playercharacter_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Удаление персонажа игрока'
        context['message'] = f'Вы уверены, что хотите удалить персонажа игрока "{self.object.name}"?'
        return context
    
    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Персонаж игрока успешно удален.')
        return super().delete(request, *args, **kwargs)


class PlayerCharacterCreateView(CreateView):
    model = PlayerCharacter
    form_class = PlayerCharacterForm
    template_name = 'game_manager/playercharacter/form.html'
    success_url = reverse_lazy('playercharacter_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        StatValueFormSet = inlineformset_factory(
            StatHolder,
            StatValue,
            form=StatValueForm,
            fields=('skill', 'initial_value', 'current_value', 'is_requirement'),
            extra=0, # Без дополнительных пустых форм
            can_delete=True
        )
        
        if self.request.POST:
            context['stat_formset'] = StatValueFormSet(
                self.request.POST,
                prefix='stats'
            )
        else:
            context['stat_formset'] = StatValueFormSet(
                queryset=StatValue.objects.none(),
                prefix='stats'
            )
        
        # Группируем навыки для отображения в шаблоне
        context['skill_groups'] = SkillGroup.objects.prefetch_related('skills')
        return context


    def form_valid(self, form):
        context = self.get_context_data()
        formset = context['stat_formset']
        
        self.object = form.save()
        
        if not formset.is_valid():
            return self.render_to_response(self.get_context_data(form=form))
        
        instances = formset.save(commit=False)
        for instance in instances:
            instance.stat_holder = self.object.stats
            instance.save()

        for obj in formset.deleted_objects:
            obj.delete()
            
        return super().form_valid(form)
    

class PlayerCharacterUpdateView(UpdateView):
    model = PlayerCharacter
    form_class = PlayerCharacterForm
    template_name = 'game_manager/playercharacter/form.html'
    success_url = reverse_lazy('playercharacter_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        StatValueFormSet = inlineformset_factory(
            StatHolder,
            StatValue,
            form=StatValueForm,
            fields=('skill', 'initial_value', 'current_value', 'is_requirement'),
            extra=0,
            can_delete=True
        )
        
        if self.request.POST:
            context['stat_formset'] = StatValueFormSet(
                self.request.POST,
                instance=self.object.stats
            )
        else:
            # Проверяем, есть ли у персонажа все возможные навыки
            existing_skills = set(sv.skill_id for sv in self.object.stats.stat_values.all())
            all_skills = set(skill.id for skill in Skill.objects.all())
            missing_skills = all_skills - existing_skills
            
            # Если есть недостающие навыки, создаем их
            if missing_skills:
                for skill_id in missing_skills:
                    skill = Skill.objects.get(id=skill_id)
                    StatValue.objects.create(
                        stat_holder=self.object.stats,
                        skill=skill,
                        initial_value=0,
                        current_value=0,
                        is_requirement=False
                    )
            
            context['stat_formset'] = StatValueFormSet(
                instance=self.object.stats
            )
        
        context['skill_groups'] = SkillGroup.objects.prefetch_related('skills')
        return context


    def form_valid(self, form):
        context = self.get_context_data()
        formset = context['stat_formset']
        if formset.is_valid():
            formset.save()
        return super().form_valid(form)