# game_manager/views.py
from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from django.forms import formset_factory, modelformset_factory
from .models import *
from .forms import *

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

# SkillGroup Views
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

# Skill Views
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

# GameItem Views
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

# NPC Views
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

# SceneMap Views
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

# Location Views
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

# PlayerCharacter Views
class PlayerCharacterListView(ListView):
    model = PlayerCharacter
    context_object_name = 'characters'
    template_name = 'game_manager/playercharacter/list.html'

class PlayerCharacterCreateView(CreateView):
    model = PlayerCharacter
    form_class = PlayerCharacterForm
    template_name = 'game_manager/playercharacter/form.html'
    success_url = reverse_lazy('playercharacter_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Создание персонажа игрока'
        context['skill_groups'] = SkillGroup.objects.all().prefetch_related('skills')
        
        if self.request.POST:
            context['skills_formset'] = StatValueFormSet(self.request.POST)
        else:
            context['skills_formset'] = StatValueFormSet()
            
        return context
    
    def form_valid(self, form):
        context = self.get_context_data()
        skills_formset = context['skills_formset']
        
        if form.is_valid() and skills_formset.is_valid():
            # Сохраняем персонажа
            self.object = form.save()
            
            # Создаем и связываем StatHolder
            holder = self.object.stats
            
            # Сохраняем формсет, но не коммитим изменения
            instances = skills_formset.save(commit=False)
            
            # Связываем каждый StatValue с созданным StatHolder
            for instance in instances:
                instance.stat_holder = holder
                instance.save()
                
            # Обрабатываем удаленные экземпляры
            for instance in skills_formset.deleted_objects:
                instance.delete()
                
            messages.success(self.request, 'Персонаж успешно создан.')
            return redirect(self.success_url)
        else:
            return self.form_invalid(form)

class PlayerCharacterDetailView(DetailView):
    model = PlayerCharacter
    context_object_name = 'character'
    template_name = 'game_manager/playercharacter/detail.html'

class PlayerCharacterUpdateView(UpdateView):
    model = PlayerCharacter
    form_class = PlayerCharacterForm
    template_name = 'game_manager/playercharacter/form.html'
    success_url = reverse_lazy('playercharacter_list')
    
    def get_object(self, queryset=None):
        """Получение объекта с предварительной загрузкой зависимостей"""
        obj = super().get_object(queryset)
        # Предварительная загрузка статов, если они существуют
        self.get_or_create_stat_holder(obj)
        return obj
    
    def get_or_create_stat_holder(self, player_character):
        """Получение или создание держателя навыков для персонажа"""
        content_type = ContentType.objects.get_for_model(PlayerCharacter)
        holder, created = StatHolder.objects.get_or_create(
            content_type=content_type,
            object_id=player_character.id
        )
        return holder
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Редактирование персонажа игрока'
        
        # Получаем держатель навыков
        stat_holder = self.get_or_create_stat_holder(self.object)
        
        # Создаем формсет для навыков
        StatValueFormSet = modelformset_factory(
            StatValue,
            fields=('skill', 'initial_value', 'current_value'),
            extra=1,
            can_delete=True,
            widgets={
                'skill': forms.Select(attrs={'class': 'form-control'}),
                'initial_value': forms.NumberInput(attrs={'class': 'form-control', 'min': 0, 'max': 100}),
                'current_value': forms.NumberInput(attrs={'class': 'form-control', 'min': 0, 'max': 100})
            }
        )
        
        # Инициализируем формсет
        if self.request.POST:
            context['stat_formset'] = StatValueFormSet(
                self.request.POST,
                queryset=StatValue.objects.filter(stat_holder=stat_holder)
            )
        else:
            context['stat_formset'] = StatValueFormSet(
                queryset=StatValue.objects.filter(stat_holder=stat_holder)
            )
        
        # Добавляем группы навыков для организации интерфейса
        context['skill_groups'] = SkillGroup.objects.all().prefetch_related('skills')
        
        # Сохраняем текущие навыки в словаре для удобства отображения
        stat_values = StatValue.objects.filter(stat_holder=stat_holder)
        context['character_stats'] = {sv.skill_id: {
            'initial_value': sv.initial_value,
            'current_value': sv.current_value
        } for sv in stat_values}
        
        return context
    
    def form_valid(self, form):
        """Обработка валидной формы"""
        context = self.get_context_data()
        stat_formset = context['stat_formset']
        
        if form.is_valid() and stat_formset.is_valid():
            # Сохраняем основные данные персонажа
            self.object = form.save()
            
            # Получаем держатель навыков
            stat_holder = self.get_or_create_stat_holder(self.object)
            
            # Сохраняем формсет навыков
            instances = stat_formset.save(commit=False)
            for instance in instances:
                instance.stat_holder = stat_holder
                instance.save()
            
            # Обрабатываем удаленные экземпляры
            for obj in stat_formset.deleted_objects:
                obj.delete()
            
            messages.success(self.request, f'Персонаж {self.object.name} успешно обновлен.')
            return redirect(self.get_success_url())
        else:
            return self.form_invalid(form)
    
    def form_invalid(self, form):
        """Обработка невалидной формы"""
        messages.error(self.request, 'Возникли ошибки при сохранении персонажа.')
        return super().form_invalid(form)



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
