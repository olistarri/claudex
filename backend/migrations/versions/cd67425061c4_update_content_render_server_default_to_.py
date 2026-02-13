"""update content_render server default to events only

Revision ID: cd67425061c4
Revises: 1be19e738a72
Create Date: 2026-02-13 01:51:53.860351

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd67425061c4'
down_revision: Union[str, None] = '1be19e738a72'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "messages",
        "content_render",
        server_default='{"events": []}',
    )


def downgrade() -> None:
    op.alter_column(
        "messages",
        "content_render",
        server_default='{"segments": []}',
    )
