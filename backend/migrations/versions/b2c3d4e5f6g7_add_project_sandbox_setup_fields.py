"""Add project sandbox setup fields

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6g7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("git_repo_url", sa.String(512), nullable=True))
    op.add_column("projects", sa.Column("git_branch", sa.String(128), nullable=True))
    op.add_column("projects", sa.Column("setup_commands", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "setup_commands")
    op.drop_column("projects", "git_branch")
    op.drop_column("projects", "git_repo_url")
