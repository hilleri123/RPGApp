# game_manager/urls.py
from django.urls import path
from game_manager import views

urlpatterns = [
    path('', views.index, name='index'),
    
    # SkillGroup URLs
    path('skillgroups/', views.SkillGroupListView.as_view(), name='skillgroup_list'),
    path('skillgroups/add/', views.SkillGroupCreateView.as_view(), name='skillgroup_create'),
    path('skillgroups/<int:pk>/', views.SkillGroupDetailView.as_view(), name='skillgroup_detail'),
    path('skillgroups/<int:pk>/edit/', views.SkillGroupUpdateView.as_view(), name='skillgroup_update'),
    path('skillgroups/<int:pk>/delete/', views.SkillGroupDeleteView.as_view(), name='skillgroup_delete'),
    
    # Skill URLs
    path('skills/', views.SkillListView.as_view(), name='skill_list'),
    path('skills/add/', views.SkillCreateView.as_view(), name='skill_create'),
    path('skills/<int:pk>/', views.SkillDetailView.as_view(), name='skill_detail'),
    path('skills/<int:pk>/edit/', views.SkillUpdateView.as_view(), name='skill_update'),
    path('skills/<int:pk>/delete/', views.SkillDeleteView.as_view(), name='skill_delete'),
    
    # GameItem URLs
    path('gameitems/', views.GameItemListView.as_view(), name='gameitem_list'),
    path('gameitems/add/', views.GameItemCreateView.as_view(), name='gameitem_create'),
    path('gameitems/<int:pk>/', views.GameItemDetailView.as_view(), name='gameitem_detail'),
    path('gameitems/<int:pk>/edit/', views.GameItemUpdateView.as_view(), name='gameitem_update'),
    path('gameitems/<int:pk>/delete/', views.GameItemDeleteView.as_view(), name='gameitem_delete'),
    
    # NPC URLs
    path('npcs/', views.NPCListView.as_view(), name='npc_list'),
    path('npcs/add/', views.NPCCreateView.as_view(), name='npc_create'),
    path('npcs/<int:pk>/', views.NPCDetailView.as_view(), name='npc_detail'),
    path('npcs/<int:pk>/edit/', views.NPCUpdateView.as_view(), name='npc_update'),
    path('npcs/<int:pk>/delete/', views.NPCDeleteView.as_view(), name='npc_delete'),
    
    # SceneMap URLs
    path('scenemaps/', views.SceneMapListView.as_view(), name='scenemap_list'),
    path('scenemaps/add/', views.SceneMapCreateView.as_view(), name='scenemap_create'),
    path('scenemaps/<int:pk>/', views.SceneMapDetailView.as_view(), name='scenemap_detail'),
    path('scenemaps/<int:pk>/edit/', views.SceneMapUpdateView.as_view(), name='scenemap_update'),
    path('scenemaps/<int:pk>/delete/', views.SceneMapDeleteView.as_view(), name='scenemap_delete'),
    
    # Location URLs
    path('locations/', views.LocationListView.as_view(), name='location_list'),
    path('locations/add/', views.LocationCreateView.as_view(), name='location_create'),
    path('locations/<int:pk>/', views.LocationDetailView.as_view(), name='location_detail'),
    path('locations/<int:pk>/edit/', views.LocationUpdateView.as_view(), name='location_update'),
    path('locations/<int:pk>/delete/', views.LocationDeleteView.as_view(), name='location_delete'),
    
    # PlayerCharacter URLs
    path('playercharacters/', views.PlayerCharacterListView.as_view(), name='playercharacter_list'),
    path('playercharacters/add/', views.PlayerCharacterCreateView.as_view(), name='playercharacter_create'),
    path('playercharacters/<int:pk>/', views.PlayerCharacterDetailView.as_view(), name='playercharacter_detail'),
    path('playercharacters/<int:pk>/edit/', views.PlayerCharacterUpdateView.as_view(), name='playercharacter_update'),
    path('playercharacters/<int:pk>/delete/', views.PlayerCharacterDeleteView.as_view(), name='playercharacter_delete'),
    
    # WhereObject URLs
    path('whereobjects/', views.WhereObjectListView.as_view(), name='whereobject_list'),
    path('whereobjects/add/', views.WhereObjectCreateView.as_view(), name='whereobject_create'),
    path('whereobjects/<int:pk>/', views.WhereObjectDetailView.as_view(), name='whereobject_detail'),
    path('whereobjects/<int:pk>/edit/', views.WhereObjectUpdateView.as_view(), name='whereobject_update'),
    path('whereobjects/<int:pk>/delete/', views.WhereObjectDeleteView.as_view(), name='whereobject_delete'),
    
    # GlobalSession URLs
    path('globalsessions/', views.GlobalSessionListView.as_view(), name='globalsession_list'),
    path('globalsessions/add/', views.GlobalSessionCreateView.as_view(), name='globalsession_create'),
    path('globalsessions/<int:pk>/', views.GlobalSessionDetailView.as_view(), name='globalsession_detail'),
    path('globalsessions/<int:pk>/edit/', views.GlobalSessionUpdateView.as_view(), name='globalsession_update'),
    path('globalsessions/<int:pk>/delete/', views.GlobalSessionDeleteView.as_view(), name='globalsession_delete'),
    
    # PlayerAction URLs
    path('playeractions/', views.PlayerActionListView.as_view(), name='playeraction_list'),
    path('playeractions/add/', views.PlayerActionCreateView.as_view(), name='playeraction_create'),
    path('playeractions/<int:pk>/', views.PlayerActionDetailView.as_view(), name='playeraction_detail'),
    path('playeractions/<int:pk>/edit/', views.PlayerActionUpdateView.as_view(), name='playeraction_update'),
    path('playeractions/<int:pk>/delete/', views.PlayerActionDeleteView.as_view(), name='playeraction_delete'),
    
    # MapObjectPolygon URLs
    path('mapobjects/', views.MapObjectPolygonListView.as_view(), name='mapobjectpolygon_list'),
    path('mapobjects/add/', views.MapObjectPolygonCreateView.as_view(), name='mapobjectpolygon_create'),
    path('mapobjects/<int:pk>/', views.MapObjectPolygonDetailView.as_view(), name='mapobjectpolygon_detail'),
    path('mapobjects/<int:pk>/edit/', views.MapObjectPolygonUpdateView.as_view(), name='mapobjectpolygon_update'),
    path('mapobjects/<int:pk>/delete/', views.MapObjectPolygonDeleteView.as_view(), name='mapobjectpolygon_delete'),
    
    # GameEvent URLs
    path('gameevents/', views.GameEventListView.as_view(), name='gameevent_list'),
    path('gameevents/add/', views.GameEventCreateView.as_view(), name='gameevent_create'),
    path('gameevents/<int:pk>/', views.GameEventDetailView.as_view(), name='gameevent_detail'),
    path('gameevents/<int:pk>/edit/', views.GameEventUpdateView.as_view(), name='gameevent_update'),
    path('gameevents/<int:pk>/delete/', views.GameEventDeleteView.as_view(), name='gameevent_delete'),
    
    # Note URLs
    path('notes/', views.NoteListView.as_view(), name='note_list'),
    path('notes/add/', views.NoteCreateView.as_view(), name='note_create'),
    path('notes/<int:pk>/', views.NoteDetailView.as_view(), name='note_detail'),
    path('notes/<int:pk>/edit/', views.NoteUpdateView.as_view(), name='note_update'),
    path('notes/<int:pk>/delete/', views.NoteDeleteView.as_view(), name='note_delete'),

    path('statholders/', views.StatHolderListView.as_view(), name='statholder_list'),
]
