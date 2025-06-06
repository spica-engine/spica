FROM node:22-slim AS base

# install necessary tools
FROM base AS tools
RUN apt-get update && apt-get install git -y

# install app deps to nodejs image
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/package.json
RUN yarn install --frozen-lockfile

# install app production deps to nodejs image
FROM base AS deps-production
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/package.json
RUN yarn install --frozen-lockfile --production

# build app to nodejs image
FROM base AS build 
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api ./apps/api
COPY libs ./libs
COPY nx.json package.json tsconfig.json yarn.lock ./
RUN yarn run build:api

# test app
FROM tools AS test
WORKDIR /app
# for mongo memory server
RUN apt-get update && apt-get install libcurl4 -y
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api ./apps/api
COPY libs ./libs
COPY nx.json package.json tsconfig.json yarn.lock ./
COPY jest.flaky.setup.js jest.preset.js jest.setup.js ./
COPY *.env ./
ARG PROJECTS=""
ARG EXCLUDE=""
ARG RABBITMQ_URL=""
ENV RABBITMQ_URL=$RABBITMQ_URL
RUN yarn nx run-many -t test --projects=$PROJECTS --exclude=$EXCLUDE 

# start app from tools, because app uses git
# copy deps and build
FROM tools AS runner
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=deps-production /app/node_modules ./node_modules
COPY --from=deps-production /app/apps/api/node_modules ./dist/apps/api/node_modules
ENV DEFAULT_PASSWORD=spica
ENV FUNCTION_GRPC_ADDRESS=0.0.0.0:5688
ENTRYPOINT ["node","./dist/apps/api/src/main.js"]