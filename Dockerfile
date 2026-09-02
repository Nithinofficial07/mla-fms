# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# MLA File Management System - single production image.
# Builds shared + server + client, then ships a slim runtime that serves the
# API and the built React SPA from one Node process on PORT (default 4000).
# ---------------------------------------------------------------------------

# ---- build stage ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# install deps first (better layer caching)
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci

# source + build
COPY . .
RUN npm run build
# drop dev dependencies from node_modules for the runtime copy
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    SERVE_CLIENT=true \
    CLIENT_DIR=/app/client/dist \
    LOCAL_STORAGE_DIR=/app/storage-data
WORKDIR /app

# tini for correct signal handling (graceful shutdown)
RUN apt-get update && apt-get install -y --no-install-recommends tini curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules      ./node_modules
COPY --from=build /app/package.json      ./package.json
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist       ./shared/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist       ./server/dist
COPY --from=build /app/client/dist       ./client/dist

# local-storage fallback dir (only used if STORAGE_PROVIDER=local)
RUN mkdir -p /app/storage-data && chown -R node:node /app
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:4000/api/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/dist/server.js"]
