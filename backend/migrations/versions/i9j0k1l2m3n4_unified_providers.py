"""unified providers

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-01-17 00:00:00.000000

"""
from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa


revision: str = 'i9j0k1l2m3n4'
down_revision: Union[str, None] = 'h8i9j0k1l2m3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    user_settings_columns = [c['name'] for c in inspector.get_columns('user_settings')]

    if 'custom_providers' not in user_settings_columns:
        op.add_column('user_settings', sa.Column('custom_providers', sa.JSON(), nullable=True))

    if 'claude_code_oauth_token' in user_settings_columns:
        op.drop_column('user_settings', 'claude_code_oauth_token')

    if 'openrouter_api_key' in user_settings_columns:
        op.drop_column('user_settings', 'openrouter_api_key')

    if 'z_ai_api_key' in user_settings_columns:
        op.drop_column('user_settings', 'z_ai_api_key')

    tables = inspector.get_table_names()
    if 'ai_models' in tables:
        unique_constraints = inspector.get_unique_constraints('ai_models')
        for constraint in unique_constraints:
            op.drop_constraint(constraint['name'], 'ai_models', type_='unique')

        indexes = inspector.get_indexes('ai_models')
        for index in indexes:
            op.drop_index(index['name'], table_name='ai_models')

        op.drop_table('ai_models')


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    user_settings_columns = [c['name'] for c in inspector.get_columns('user_settings')]

    if 'claude_code_oauth_token' not in user_settings_columns:
        op.add_column('user_settings', sa.Column('claude_code_oauth_token', sa.String(), nullable=True))

    if 'openrouter_api_key' not in user_settings_columns:
        op.add_column('user_settings', sa.Column('openrouter_api_key', sa.String(), nullable=True))

    if 'z_ai_api_key' not in user_settings_columns:
        op.add_column('user_settings', sa.Column('z_ai_api_key', sa.String(), nullable=True))

    rows = conn.execute(
        sa.text(
            "SELECT id, custom_providers FROM user_settings WHERE custom_providers IS NOT NULL"
        )
    ).fetchall()

    if rows:
        from app.core.security import decrypt_value

        for row in rows:
            value = row.custom_providers
            if value is None:
                continue
            if isinstance(value, str):
                try:
                    decrypted = decrypt_value(value)
                except Exception:
                    decrypted = value
            else:
                decrypted = value

            providers: list[dict[str, object]] = []
            if isinstance(decrypted, str):
                try:
                    parsed = json.loads(decrypted)
                    if isinstance(parsed, list):
                        providers = parsed
                except json.JSONDecodeError:
                    providers = []
            elif isinstance(decrypted, list):
                providers = decrypted

            claude_token = None
            openrouter_token = None
            for provider in providers:
                if not isinstance(provider, dict):
                    continue
                provider_type = provider.get("provider_type")
                auth_token = provider.get("auth_token")
                if provider_type == "anthropic" and claude_token is None:
                    claude_token = auth_token
                if provider_type == "openrouter" and openrouter_token is None:
                    openrouter_token = auth_token

            conn.execute(
                sa.text(
                    "UPDATE user_settings SET claude_code_oauth_token = :claude_token, openrouter_api_key = :openrouter_token WHERE id = :id"
                ),
                {
                    "claude_token": claude_token,
                    "openrouter_token": openrouter_token,
                    "id": row.id,
                },
            )

    if 'custom_providers' in user_settings_columns:
        op.drop_column('user_settings', 'custom_providers')

    # Recreate ai_models table
    op.create_table(
        'ai_models',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('model_id', sa.String(100), nullable=False, unique=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('sort_order', sa.Integer(), default=0, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('idx_ai_models_provider_active', 'ai_models', ['provider', 'is_active'])
    op.create_index('idx_ai_models_sort_order', 'ai_models', ['sort_order'])
    op.create_index(op.f('ix_ai_models_model_id'), 'ai_models', ['model_id'], unique=True)
