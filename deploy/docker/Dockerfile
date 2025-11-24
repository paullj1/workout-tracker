# ---- Frontend build stage ----
FROM node:20 AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ---- Wheel build stage ----
FROM ghcr.io/astral-sh/uv:alpine AS wheel-build
WORKDIR /app

COPY pyproject.toml README.md uv.lock ./
COPY src/ ./src
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

RUN uv build --wheel

# ---- Runtime stage ----
FROM ghcr.io/astral-sh/uv:alpine AS runtime
WORKDIR /app

COPY --from=wheel-build /app/dist /tmp/dist
RUN uv tool install /tmp/dist/*.whl && rm -rf /tmp/dist

EXPOSE 8000
CMD ["workout-tracker-api"]
