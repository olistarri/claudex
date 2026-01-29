# CLAUDE.md

## SQLAlchemy Model Conventions

- Always add `server_default=` when using `default=` - the `default` only applies in Python/ORM, while `server_default` ensures the database has the default value for raw SQL inserts
- Always specify `nullable=True` or `nullable=False` explicitly
- Always add max length to String fields (e.g., `String(64)` not just `String`)
- Use `DateTime(timezone=True)` for all datetime fields for consistency
- Don't add `index=True` on FK columns if a composite index starting with that column already exists (composite indexes can serve single-column lookups)

## Code Style

- Don't add comments or docstrings for self-explanatory code
- Let the code speak for itself - use clear variable/function names instead of comments
