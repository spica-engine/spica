# syntax=docker/dockerfile:1
FROM node:22-slim AS base


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

FROM tools AS runner
WORKDIR /app
COPY dist .
RUN yarn install --production --network-timeout 600000
ENTRYPOINT ["node","src/main.js"]