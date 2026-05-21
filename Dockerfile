# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app

COPY frontend/package.json frontend/yarn.lock ./

# Remove the Emergent-cloud devDep — not accessible outside Emergent infra
# and not needed for a production build (craco guards it with isDevServer check)
RUN node -e "\
  const p = require('./package.json');\
  delete p.devDependencies['@emergentbase/visual-edits'];\
  require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2));\
"

RUN yarn install --network-timeout 300000

COPY frontend/ .

# Empty string → all axios calls become relative URLs (/api/...)
ENV REACT_APP_BACKEND_URL=
RUN yarn build

# ── Stage 2: Python backend + serve the React build ─────────────────────────
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/build ./frontend/build

EXPOSE 8000
CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8000"]
