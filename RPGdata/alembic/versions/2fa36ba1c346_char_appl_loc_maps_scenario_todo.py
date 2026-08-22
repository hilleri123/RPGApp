"""char_appl + loc maps + scenario todo

Revision ID: 2fa36ba1c346
Revises: 94f5d2dec9c7
Create Date: 2026-05-05 11:29:30.937802

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2fa36ba1c346'
down_revision: Union[str, None] = '94f5d2dec9c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'character_application',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('rule_id_str', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('short_desc', sa.String(), nullable=True),
        sa.Column('story', sa.Text(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('icon_url', sa.String(256), nullable=True),
        sa.Column('icon_path', sa.String(), nullable=True),
        sa.Column('img_url', sa.String(256), nullable=True),
        sa.Column('img_path', sa.String(), nullable=True),
        sa.Column('player_comment', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum(
            'draft', 'submitted', 'in_review', 'needs_changes', 'approved', 'rejected',
            name='applicationstatus',
        ), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_character_application_id'), 'character_application', ['id'], unique=False)
    op.create_index(op.f('ix_character_application_rule_id_str'), 'character_application', ['rule_id_str'], unique=False)
    op.create_index(op.f('ix_character_application_status'), 'character_application', ['status'], unique=False)
    op.create_index(op.f('ix_character_application_user_id'), 'character_application', ['user_id'], unique=False)

    op.create_table(
        'application_review',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('application_id', sa.Uuid(), nullable=False),
        sa.Column('author_id', sa.Uuid(), nullable=True),
        sa.Column('status_set_to', sa.Enum(
            'draft', 'submitted', 'in_review', 'needs_changes', 'approved', 'rejected',
            name='applicationstatus',
        ), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('proposed_data', sa.JSON(), nullable=True),
        sa.Column('is_player_note', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['character_application.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['user.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_application_review_id'), 'application_review', ['id'], unique=False)
    op.create_index(op.f('ix_application_review_application_id'), 'application_review', ['application_id'], unique=False)

    op.create_table(
        'scenario_todo',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('scenario_id', sa.Uuid(), nullable=False),
        sa.Column('element_type', sa.Enum(
            'location', 'scene', 'npc', 'item', 'story_beat', 'scene_exposure',
            'character', 'map_polygon', 'audio_track', 'scenario', 'other',
            name='todoelementtype',
        ), nullable=False),
        sa.Column('element_id', sa.Uuid(), nullable=True),
        sa.Column('element_name', sa.String(), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('priority', sa.Enum('low', 'medium', 'high', name='todopriority'), nullable=False),
        sa.Column('is_done', sa.Boolean(), nullable=False),
        sa.Column('done_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['scenario_id'], ['scenario.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_scenario_todo_id'), 'scenario_todo', ['id'], unique=False)
    op.create_index(op.f('ix_scenario_todo_scenario_id'), 'scenario_todo', ['scenario_id'], unique=False)

    op.create_table(
        'application_item_request',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('application_id', sa.Uuid(), nullable=False),
        sa.Column('requested_item_id', sa.Uuid(), nullable=True),
        sa.Column('requested_name', sa.String(), nullable=True),
        sa.Column('player_comment', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum(
            'pending', 'approved', 'rejected', 'modified',
            name='itemrequeststatus',
        ), nullable=False),
        sa.Column('master_comment', sa.Text(), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decided_by_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['character_application.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['decided_by_id'], ['user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['requested_item_id'], ['rule_item_template.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_application_item_request_id'), 'application_item_request', ['id'], unique=False)
    op.create_index(op.f('ix_application_item_request_application_id'), 'application_item_request', ['application_id'], unique=False)

    op.create_table(
        'character_application_item',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('application_id', sa.Uuid(), nullable=False),
        sa.Column('item_id', sa.Uuid(), nullable=False),
        sa.Column('item_request_id', sa.Uuid(), nullable=True),
        sa.Column('master_comment', sa.Text(), nullable=True),
        sa.Column('granted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('granted_by_id', sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(['application_id'], ['character_application.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by_id'], ['user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['item_id'], ['game_item.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['item_request_id'], ['application_item_request.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_character_application_item_id'), 'character_application_item', ['id'], unique=False)
    op.create_index(op.f('ix_character_application_item_application_id'), 'character_application_item', ['application_id'], unique=False)

    # ── location ──────────────────────────────────────────────────────────────
    op.add_column('location', sa.Column('icon_path', sa.String(), nullable=True))
    op.add_column('location', sa.Column('image_map_path', sa.String(), nullable=True))
    op.add_column('location', sa.Column('excalidraw_map_json', sa.JSON(), nullable=True))
    op.add_column('location', sa.Column('sh3d_map_path', sa.String(), nullable=True))
    op.add_column('location', sa.Column('images_path', sa.JSON(), nullable=True))

    # ── player_character ──────────────────────────────────────────────────────
    op.add_column('player_character', sa.Column('icon_path', sa.String(), nullable=True))
    op.add_column('player_character', sa.Column('img_path', sa.String(), nullable=True))

    # ── scene_exposure_template_item ──────────────────────────────────────────
    # Меняем составной PK (scene_exposure_id, template_item_id) → суррогатный id
    op.drop_constraint('scene_exposure_template_item_pkey', 'scene_exposure_template_item', type_='primary')

    # Добавляем nullable — потом заполним и поставим NOT NULL
    op.add_column('scene_exposure_template_item', sa.Column('id', sa.Uuid(), nullable=True))
    op.add_column('scene_exposure_template_item', sa.Column('qty', sa.Integer(), nullable=True))

    op.execute("UPDATE scene_exposure_template_item SET id = gen_random_uuid(), qty = 1 WHERE id IS NULL")

    op.alter_column('scene_exposure_template_item', 'id',  nullable=False)
    op.alter_column('scene_exposure_template_item', 'qty', nullable=False)

    op.create_primary_key('scene_exposure_template_item_pkey', 'scene_exposure_template_item', ['id'])
    op.create_index(op.f('ix_scene_exposure_template_item_scene_exposure_id'), 'scene_exposure_template_item', ['scene_exposure_id'], unique=False)

    # ── scene_exposure_template_npc ───────────────────────────────────────────
    op.drop_constraint('scene_exposure_template_npc_pkey', 'scene_exposure_template_npc', type_='primary')

    op.add_column('scene_exposure_template_npc', sa.Column('id', sa.Uuid(), nullable=True))
    op.add_column('scene_exposure_template_npc', sa.Column('qty', sa.Integer(), nullable=True))

    op.execute("UPDATE scene_exposure_template_npc SET id = gen_random_uuid(), qty = 1 WHERE id IS NULL")

    op.alter_column('scene_exposure_template_npc', 'id',  nullable=False)
    op.alter_column('scene_exposure_template_npc', 'qty', nullable=False)

    op.create_primary_key('scene_exposure_template_npc_pkey', 'scene_exposure_template_npc', ['id'])
    op.create_index(op.f('ix_scene_exposure_template_npc_scene_exposure_id'), 'scene_exposure_template_npc', ['scene_exposure_id'], unique=False)


def downgrade() -> None:
    # ── scene_exposure_template_npc ───────────────────────────────────────────
    op.drop_index(op.f('ix_scene_exposure_template_npc_scene_exposure_id'), table_name='scene_exposure_template_npc')
    op.drop_constraint('scene_exposure_template_npc_pkey', 'scene_exposure_template_npc', type_='primary')
    op.drop_column('scene_exposure_template_npc', 'qty')
    op.drop_column('scene_exposure_template_npc', 'id')
    op.create_primary_key('scene_exposure_template_npc_pkey', 'scene_exposure_template_npc', ['scene_exposure_id', 'template_npc_id'])

    # ── scene_exposure_template_item ──────────────────────────────────────────
    op.drop_index(op.f('ix_scene_exposure_template_item_scene_exposure_id'), table_name='scene_exposure_template_item')
    op.drop_constraint('scene_exposure_template_item_pkey', 'scene_exposure_template_item', type_='primary')
    op.drop_column('scene_exposure_template_item', 'qty')
    op.drop_column('scene_exposure_template_item', 'id')
    op.create_primary_key('scene_exposure_template_item_pkey', 'scene_exposure_template_item', ['scene_exposure_id', 'template_item_id'])

    # ── player_character ──────────────────────────────────────────────────────
    op.drop_column('player_character', 'img_path')
    op.drop_column('player_character', 'icon_path')

    # ── location ──────────────────────────────────────────────────────────────
    op.drop_column('location', 'images_path')
    op.drop_column('location', 'sh3d_map_path')
    op.drop_column('location', 'excalidraw_map_json')
    op.drop_column('location', 'image_map_path')
    op.drop_column('location', 'icon_path')

    # ── новые таблицы (в обратном порядке зависимостей) ───────────────────────
    op.drop_index(op.f('ix_character_application_item_application_id'), table_name='character_application_item')
    op.drop_index(op.f('ix_character_application_item_id'), table_name='character_application_item')
    op.drop_table('character_application_item')

    op.drop_index(op.f('ix_application_item_request_application_id'), table_name='application_item_request')
    op.drop_index(op.f('ix_application_item_request_id'), table_name='application_item_request')
    op.drop_table('application_item_request')

    op.drop_index(op.f('ix_scenario_todo_scenario_id'), table_name='scenario_todo')
    op.drop_index(op.f('ix_scenario_todo_id'), table_name='scenario_todo')
    op.drop_table('scenario_todo')

    op.drop_index(op.f('ix_application_review_application_id'), table_name='application_review')
    op.drop_index(op.f('ix_application_review_id'), table_name='application_review')
    op.drop_table('application_review')

    op.drop_index(op.f('ix_character_application_user_id'), table_name='character_application')
    op.drop_index(op.f('ix_character_application_status'), table_name='character_application')
    op.drop_index(op.f('ix_character_application_rule_id_str'), table_name='character_application')
    op.drop_index(op.f('ix_character_application_id'), table_name='character_application')
    op.drop_table('character_application')

    op.execute("DROP TYPE IF EXISTS applicationstatus")
    op.execute("DROP TYPE IF EXISTS itemrequeststatus")
    op.execute("DROP TYPE IF EXISTS todoelementtype")
    op.execute("DROP TYPE IF EXISTS todopriority")