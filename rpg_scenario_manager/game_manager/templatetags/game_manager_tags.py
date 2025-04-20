# game_manager/templatetags/game_manager_tags.py
from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """Получает значение из словаря по ключу"""
    return dictionary.get(key)

@register.filter
def get_form_for_skill(formset, skill_obj):
    """Возвращает форму для конкретного объекта навыка"""
    for form in formset:
        if form.instance.skill_id == skill_obj.id:
            return form
    return formset.empty_form