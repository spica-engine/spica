# syntax=docker/dockerfile:1
FROM node:22-slim AS base

# install necessary tools
FROM base AS tools
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install git -y


FROM tools AS runner
WORKDIR /app
COPY dist .
RUN yarn install --production --network-timeout 600000
ENV DEFAULT_PASSWORD=spica
ENV FUNCTION_GRPC_ADDRESS=0.0.0.0:5688
ENTRYPOINT ["node","src/main.js"]