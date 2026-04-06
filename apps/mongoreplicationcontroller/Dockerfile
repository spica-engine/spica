# syntax=docker/dockerfile:1
FROM node:22-slim AS base

ENV NX_DAEMON=false
ENV NX_NO_CLOUD=true
ENV NX_CACHE_DIRECTORY=/app/.nx/cache
ENV NX_WORKSPACE_DATA_DIRECTORY=/app/.nx/workspace-data

# install tools to nodejs image
FROM base AS tools
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y gnupg curl \
    && curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor \
    && echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" | tee /etc/apt/sources.list.d/mongodb-org-8.0.list \
    && apt-get update && apt-get install -y mongodb-mongosh \
    && apt-get purge -y gnupg curl && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# install app deps to nodejs image
FROM base AS deps
WORKDIR /app
ARG TARGETPLATFORM
COPY package.json yarn.lock ./
COPY apps/mongoreplicationcontroller/package.json ./apps/mongoreplicationcontroller/package.json
RUN --mount=type=cache,target=/root/.yarn-cache,id=mongorepl-yarn-${TARGETPLATFORM},sharing=locked \
    YARN_CACHE_FOLDER=/root/.yarn-cache \
    yarn install --frozen-lockfile --network-timeout 600000

# build app to nodejs image
FROM base AS build
WORKDIR /app
ARG TARGETPLATFORM
COPY --from=deps /app/node_modules ./node_modules
COPY apps/mongoreplicationcontroller ./apps/mongoreplicationcontroller
COPY nx.json package.json tsconfig.json tsconfig.base.json yarn.lock ./
RUN --mount=type=cache,target=/app/.nx/cache,id=mongorepl-nx-cache-${TARGETPLATFORM},sharing=locked \
    --mount=type=cache,target=/app/.nx/workspace-data,id=mongorepl-nx-workspace-${TARGETPLATFORM},sharing=locked \
    yarn run build:mongoreplicationcontroller

# start app from tools, because app executes many mongodb commands
# copy deps and build
FROM tools AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/mongoreplicationcontroller/dist ./dist
COPY --from=build /app/apps/mongoreplicationcontroller/package.json ./package.json
ENTRYPOINT ["node","./dist/src/main.js"]