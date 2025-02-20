FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/panel/package.json ./apps/panel/package.json
RUN yarn install --frozen-lockfile

# build app
FROM base AS build 
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/panel ./apps/panel
COPY nx.json ./
COPY package.json ./
COPY yarn.lock ./
ARG BASE_URL=""
RUN BASE_URL=$BASE_URL yarn run build:panel

# start app
FROM nginx:alpine as prod
COPY --from=build /app/dist/panel /usr/share/nginx/html
COPY ./apps/panel/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]