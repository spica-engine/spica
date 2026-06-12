# syntax=docker/dockerfile:1
FROM node:22-slim AS base

FROM base AS runner
WORKDIR /app
COPY dist .
RUN yarn install --production --network-timeout 600000
ENV NODE_ENV=production
ENV DEFAULT_PASSWORD=spica
ENV FUNCTION_GRPC_ADDRESS=0.0.0.0:5688
ENTRYPOINT ["node","src/main.js"]