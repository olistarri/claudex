"""add projects table and chat project FK

Revision ID: a1b2c3d4e5f6
Revises: cd67425061c4
Create Date: 2026-02-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.db.types import GUID

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'cd67425061c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'projects',
        sa.Column('id', GUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', GUID(), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('folder_name', sa.String(length=255), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('custom_instructions', sa.Text(), nullable=True),
        sa.Column('custom_agents', sa.JSON(), nullable=True),
        sa.Column('custom_mcps', sa.JSON(), nullable=True),
        sa.Column('custom_env_vars', sa.JSON(), nullable=True),
        sa.Column('custom_skills', sa.JSON(), nullable=True),
        sa.Column('custom_slash_commands', sa.JSON(), nullable=True),
        sa.Column('custom_prompts', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'folder_name', name='uq_projects_user_folder'),
    )
    op.create_index('idx_projects_user_id', 'projects', ['user_id'])

    op.add_column('chats', sa.Column('project_id', GUID(), nullable=True))
    op.create_foreign_key(
        'fk_chats_project_id',
        'chats',
        'projects',
        ['project_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index('idx_chats_project_id', 'chats', ['project_id'])

    # Data migration: create a default project per user, assign all chats
    op.execute("""
        INSERT INTO projects (id, user_id, name, folder_name, is_default, created_at, updated_at)
        SELECT gen_random_uuid(), id, 'Default', 'default', true, now(), now()
        FROM users
    """)
    op.execute("""
        UPDATE chats
        SET project_id = projects.id
        FROM projects
        WHERE projects.user_id = chats.user_id
          AND projects.is_default = true
    """)


def downgrade() -> None:
    op.drop_index('idx_chats_project_id', table_name='chats')
    op.drop_constraint('fk_chats_project_id', 'chats', type_='foreignkey')
    op.drop_column('chats', 'project_id')
    op.drop_index('idx_projects_user_id', table_name='projects')
    op.drop_table('projects')
