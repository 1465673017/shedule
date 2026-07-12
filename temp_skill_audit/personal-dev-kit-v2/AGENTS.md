# Personal Developer Rules

## General
- Prefer the simplest solution that solves the real problem.
- Avoid microservices, queues, Redis, Kubernetes, and heavy abstractions unless requirements justify them.
- Make small, reviewable changes.
- Do not modify unrelated files.
- State assumptions and breaking changes clearly.
- Reuse existing project patterns before creating new abstractions.

## Python
- Use Python 3.12 or newer.
- Use `uv` for dependencies and virtual environments.
- Use `pyproject.toml` as the configuration source.
- Use Ruff for formatting and linting.
- Use pytest for tests.
- Use BasedPyright or Pyright when configured.
- Prefer `pathlib`, explicit exceptions, and typed public APIs.
- Keep HTTP routes thin and business logic in services.

## Web UI
- Prefer task-focused tool interfaces over marketing-style pages.
- Use consistent spacing, typography, buttons, forms, tables, and feedback states.
- Support loading, empty, success, warning, and error states.
- Use semantic HTML and accessible labels.
- Avoid unnecessary animation and oversized dependencies.

## Data processing
- Treat uploads as untrusted.
- Validate file type, size, required columns, encoding, and values.
- Never silently discard invalid rows.
- Preserve column order unless requirements say otherwise.
- Keep transformation logic independent from web routes.
- Sanitize download filenames and clean temporary files.

## Verification
- Run the smallest relevant tests first.
- Then run the full test suite when practical.
- Run format, lint, and type checks before considering the task complete.
