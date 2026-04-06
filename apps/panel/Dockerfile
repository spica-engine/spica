
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base

ENV NX_DAEMON=false
ENV NX_NO_CLOUD=true
ENV NX_CACHE_DIRECTORY=/app/.nx/cache
ENV NX_WORKSPACE_DATA_DIRECTORY=/app/.nx/workspace-data

FROM base AS deps
WORKDIR /app
ARG TARGETPLATFORM
COPY package.json yarn.lock ./
COPY apps/panel/package.json ./apps/panel/package.json
RUN --mount=type=cache,target=/root/.yarn-cache,id=panel-deps-${TARGETPLATFORM},sharing=locked \
    YARN_CACHE_FOLDER=/root/.yarn-cache \
    yarn install --frozen-lockfile --network-timeout 600000

# build app
FROM base AS build
WORKDIR /app
ARG TARGETPLATFORM
ARG BASE_URL=""
ARG VITE_BASE_URL=""
COPY --from=deps /app/node_modules ./node_modules
COPY apps/panel ./apps/panel
COPY nx.json package.json yarn.lock ./
RUN --mount=type=cache,target=/app/.nx/cache,id=nx-cache-panel-${TARGETPLATFORM},sharing=locked \
    --mount=type=cache,target=/app/.nx/workspace-data,id=nx-workspace-panel-${TARGETPLATFORM},sharing=locked \
    BASE_URL=$BASE_URL VITE_BASE_URL=$VITE_BASE_URL yarn run build:panel

# start app
FROM nginx:alpine AS prod
COPY --from=build /app/dist/panel /usr/share/nginx/html
COPY ./apps/panel/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
