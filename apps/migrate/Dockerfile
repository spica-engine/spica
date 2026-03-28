# syntax=docker/dockerfile:1
FROM node:22-slim AS base

ENV NX_DAEMON=false
ENV NX_NO_CLOUD=true
ENV NX_CACHE_DIRECTORY=/app/.nx/cache
ENV NX_WORKSPACE_DATA_DIRECTORY=/app/.nx/workspace-data

# install app deps to nodejs image
FROM base AS deps
WORKDIR /app
ARG TARGETPLATFORM
COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/root/.yarn-cache,id=migrate-yarn-${TARGETPLATFORM},sharing=locked \
    YARN_CACHE_FOLDER=/root/.yarn-cache \
    yarn install --frozen-lockfile --network-timeout 600000

# build app to nodejs image
FROM base AS build
WORKDIR /app
ARG TARGETPLATFORM
COPY --from=deps /app/node_modules ./node_modules
COPY apps/migrate ./apps/migrate
COPY nx.json package.json tsconfig.json yarn.lock ./
RUN --mount=type=cache,target=/app/.nx/cache,id=migrate-nx-cache-${TARGETPLATFORM},sharing=locked \
    --mount=type=cache,target=/app/.nx/workspace-data,id=migrate-nx-workspace-${TARGETPLATFORM},sharing=locked \
    yarn run build:migrate

FROM base AS test
WORKDIR /app
# for mongo memory server
RUN apt-get update && apt-get install libcurl4 -y
COPY --from=deps /app/node_modules ./node_modules
COPY apps/migrate ./apps/migrate
COPY nx.json package.json tsconfig.json yarn.lock ./
COPY jest.flaky.setup.js jest.preset.js jest.setup.js ./
COPY libs/database ./libs/database
COPY libs/interface/database ./libs/interface/database
COPY *.env ./
ARG MONGODB_URL=""
ENV MONGODB_URL=$MONGODB_URL
RUN yarn run test:migrate

# copy deps and build
FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node","./dist/apps/migrate/src/main.js"]
