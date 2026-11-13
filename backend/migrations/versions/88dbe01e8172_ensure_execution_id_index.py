"""Ensure execution ID index

Revision ID: 88dbe01e8172
Revises: 92af20102463
"""

from alembic import op

revision = "88dbe01e8172"
down_revision = "92af20102463"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_evaluation_case_results_execution_id",
        "evaluation_case_results",
        ["execution_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_evaluation_case_results_execution_id",
        table_name="evaluation_case_results",
    )