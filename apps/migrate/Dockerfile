# syntax=docker/dockerfile:1
FROM node:22-slim AS base

FROM base AS runner
WORKDIR /app
COPY dist .
RUN yarn install --production --network-timeout 600000
ENTRYPOINT ["node","src/main.js"]
