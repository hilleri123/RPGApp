# Generated by Django 5.2 on 2025-04-13 14:34

import colorfield.fields
import datetime
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='GameEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Название')),
                ('xml_text', models.TextField(verbose_name='Текст события (XML)')),
                ('happened', models.BooleanField(default=False, verbose_name='Произошло')),
                ('start_time', models.DateTimeField(blank=True, null=True, verbose_name='Время начала')),
                ('end_time', models.DateTimeField(blank=True, null=True, verbose_name='Время окончания')),
            ],
            options={
                'verbose_name': 'Игровое событие',
                'verbose_name_plural': 'Игровые события',
            },
        ),
        migrations.CreateModel(
            name='GameItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='', max_length=255, verbose_name='Название')),
                ('text', models.TextField(default='', verbose_name='Описание')),
                ('bonuses_json', models.TextField(default='', verbose_name='Бонусы (JSON)')),
            ],
            options={
                'verbose_name': 'Предмет',
                'verbose_name_plural': 'Предметы',
            },
        ),
        migrations.CreateModel(
            name='GlobalSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_path', models.CharField(max_length=255, verbose_name='Путь к файлу')),
                ('intro', models.TextField(verbose_name='Вступление')),
                ('time', models.DateTimeField(default=datetime.datetime.now, verbose_name='Текущее время')),
                ('start_time', models.DateTimeField(default=datetime.datetime.now, verbose_name='Время начала')),
                ('scenario_name', models.CharField(max_length=255, verbose_name='Название сценария')),
                ('scenario_file_path', models.CharField(max_length=255, verbose_name='Путь к файлу сценария')),
            ],
            options={
                'verbose_name': 'Глобальная сессия',
                'verbose_name_plural': 'Глобальные сессии',
            },
        ),
        migrations.CreateModel(
            name='Location',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Название')),
                ('description', models.TextField(verbose_name='Описание')),
            ],
            options={
                'verbose_name': 'Локация',
                'verbose_name_plural': 'Локации',
            },
        ),
        migrations.CreateModel(
            name='NPC',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Имя')),
                ('path_to_img', models.CharField(max_length=255, verbose_name='Путь к изображению')),
                ('is_enemy', models.BooleanField(default=False, verbose_name='Враг')),
                ('skill_ids_json', models.TextField(default='[]', verbose_name='ID навыков (JSON)')),
                ('description', models.TextField(verbose_name='Описание')),
                ('is_dead', models.BooleanField(default=False, verbose_name='Мёртв')),
            ],
            options={
                'verbose_name': 'NPC',
                'verbose_name_plural': 'NPC',
            },
        ),
        migrations.CreateModel(
            name='PlayerAction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('description', models.TextField(verbose_name='Описание')),
                ('need_skill_ids_conditions_json', models.TextField(default='[]', verbose_name='Условия навыков (JSON)')),
                ('is_activated', models.BooleanField(default=False, verbose_name='Активировано')),
                ('need_game_item_ids_json', models.TextField(blank=True, null=True, verbose_name='Требуемые предметы (JSON)')),
                ('add_time_secs', models.IntegerField(blank=True, null=True, verbose_name='Добавочное время (сек)')),
            ],
            options={
                'verbose_name': 'Действие игрока',
                'verbose_name_plural': 'Действия игроков',
            },
        ),
        migrations.CreateModel(
            name='SceneMap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Название')),
                ('file_path', models.CharField(max_length=255, verbose_name='Путь к файлу')),
            ],
            options={
                'verbose_name': 'Карта сцены',
                'verbose_name_plural': 'Карты сцен',
            },
        ),
        migrations.CreateModel(
            name='SkillGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Название')),
            ],
            options={
                'verbose_name': 'Группа навыков',
                'verbose_name_plural': 'Группы навыков',
            },
        ),
        migrations.CreateModel(
            name='Note',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='', max_length=255, verbose_name='Название')),
                ('xml_text', models.TextField(verbose_name='Текст заметки (XML)')),
                ('player_shown_json', models.TextField(default='[]', verbose_name='Показано игрокам (JSON)')),
                ('target_player_shown_json', models.TextField(default='[]', verbose_name='Показано целевым игрокам (JSON)')),
                ('action', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='game_manager.playeraction', verbose_name='Действие')),
            ],
            options={
                'verbose_name': 'Заметка',
                'verbose_name_plural': 'Заметки',
            },
        ),
        migrations.CreateModel(
            name='PlayerCharacter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Имя')),
                ('path_to_img', models.CharField(max_length=255, verbose_name='Путь к изображению')),
                ('short_desc', models.TextField(verbose_name='Краткое описание')),
                ('story', models.TextField(verbose_name='История')),
                ('time', models.DateTimeField(default=datetime.datetime.now, verbose_name='Время')),
                ('color', colorfield.fields.ColorField(default='#FF0000', image_field=None, max_length=25, samples=None, verbose_name='Цвет')),
                ('address', models.CharField(max_length=255, verbose_name='Адрес')),
                ('player_locked', models.BooleanField(default=False, verbose_name='Персонаж заблокирован')),
                ('location', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='game_manager.location', verbose_name='Локация')),
                ('map', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='game_manager.scenemap', verbose_name='Карта')),
            ],
            options={
                'verbose_name': 'Персонаж игрока',
                'verbose_name_plural': 'Персонажи игроков',
            },
        ),
        migrations.CreateModel(
            name='MapObjectPolygon',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Название')),
                ('is_shown', models.BooleanField(default=False, verbose_name='Отображается')),
                ('is_filled', models.BooleanField(default=False, verbose_name='Заполнен')),
                ('is_line', models.BooleanField(default=False, verbose_name='Линия')),
                ('color', colorfield.fields.ColorField(default='#FF0000', image_field=None, max_length=25, samples=None, verbose_name='Цвет')),
                ('polygon_list_json', models.TextField(default='[]', verbose_name='Список координат полигона (JSON)')),
                ('icon_file_path', models.CharField(blank=True, max_length=255, null=True, verbose_name='Путь к иконке')),
                ('location', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='game_manager.location', verbose_name='Локация')),
                ('map', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='game_manager.scenemap', verbose_name='Карта')),
            ],
            options={
                'verbose_name': 'Объект карты (полигон)',
                'verbose_name_plural': 'Объекты карты (полигоны)',
            },
        ),
        migrations.AddField(
            model_name='location',
            name='leads_to',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='game_manager.scenemap', verbose_name='Ведет к карте'),
        ),
        migrations.CreateModel(
            name='Skill',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Название')),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='skills', to='game_manager.skillgroup', verbose_name='Группа')),
            ],
            options={
                'verbose_name': 'Навык',
                'verbose_name_plural': 'Навыки',
            },
        ),
        migrations.CreateModel(
            name='WhereObject',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('game_item', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to='game_manager.gameitem', verbose_name='Предмет')),
                ('location', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='game_manager.location', verbose_name='Локация')),
                ('npc', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='game_manager.npc', verbose_name='NPC')),
                ('player', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='game_manager.playercharacter', verbose_name='Игрок')),
            ],
            options={
                'verbose_name': 'Местонахождение предмета',
                'verbose_name_plural': 'Местонахождения предметов',
            },
        ),
        migrations.CreateModel(
            name='Stat',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('init_value', models.IntegerField(default=0, verbose_name='Начальное значение')),
                ('value', models.IntegerField(default=0, verbose_name='Текущее значение')),
                ('character', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='game_manager.playercharacter', verbose_name='Персонаж')),
                ('skill', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='game_manager.skill', verbose_name='Навык')),
            ],
            options={
                'verbose_name': 'Характеристика',
                'verbose_name_plural': 'Характеристики',
                'unique_together': {('character', 'skill')},
            },
        ),
    ]
