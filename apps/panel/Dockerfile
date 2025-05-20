FROM node:22-alpine AS base

# Install dependencies with full workspace context
FROM base AS deps
WORKDIR /app

# Copy entire monorepo (or at least what's needed for dependency resolution)
COPY . .

RUN yarn install --frozen-lockfile

# Build the panel app
FROM base AS build
WORKDIR /app

# Copy the full repo again to ensure consistent build context
COPY . .

COPY --from=deps /app/node_modules ./node_modules

# Optional: Set Node memory limit to avoid OOM
ENV NODE_OPTIONS=--max-old-space-size=4096

# Build panel
ARG BASE_URL=""
RUN BASE_URL=$BASE_URL yarn run build:panel

# Final nginx serving stage
FROM nginx:alpine AS prod
COPY --from=build /app/dist/panel /usr/share/nginx/html
COPY ./apps/panel/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
