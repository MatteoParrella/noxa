# Immagine del worker Noxa (ADR-0003).
# Richiede pyproject.toml e uv.lock, creati nella Fase 0 (docs/ROADMAP.md).

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

WORKDIR /app

# Dipendenze prima del codice, per sfruttare la cache dei layer.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Chromium per gli adattatori che richiedono il rendering JavaScript.
RUN uv run --no-sync playwright install --with-deps chromium

COPY src ./src
RUN uv sync --frozen --no-dev

# Utente non privilegiato.
RUN useradd --create-home --uid 10001 noxa && chown -R noxa:noxa /app /ms-playwright
USER noxa

EXPOSE 8000

# In produzione: nessun --reload. L'esecutore della coda parte nel lifespan di FastAPI.
CMD ["uv", "run", "--no-sync", "uvicorn", "noxa_worker.api:app", "--host", "0.0.0.0", "--port", "8000"]
