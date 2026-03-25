FROM node:22-slim AS base

# install necessary tools
FROM base AS tools
RUN apt-get update && apt-get install git -y

# install app deps to nodejs image
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY libs/core/package.json ./libs/core/package.json
COPY libs/database/package.json ./libs/database/package.json
COPY libs/filter/package.json ./libs/filter/package.json
COPY libs/realtime/package.json ./libs/realtime/package.json
COPY libs/representative/package.json ./libs/representative/package.json
COPY libs/transaction/package.json ./libs/transaction/package.json
COPY libs/interface/package.json ./libs/interface/package.json
COPY apps/api/src/activity/package.json ./apps/api/src/activity/package.json
COPY apps/api/src/asset/package.json ./apps/api/src/asset/package.json
COPY apps/api/src/batch/package.json ./apps/api/src/batch/package.json
COPY apps/api/src/bucket/package.json ./apps/api/src/bucket/package.json
COPY apps/api/src/config/package.json ./apps/api/src/config/package.json
COPY apps/api/src/dashboard/package.json ./apps/api/src/dashboard/package.json
COPY apps/api/src/env_var/package.json ./apps/api/src/env_var/package.json
COPY apps/api/src/function/package.json ./apps/api/src/function/package.json
COPY apps/api/src/mailer/package.json ./apps/api/src/mailer/package.json
COPY apps/api/src/passport/package.json ./apps/api/src/passport/package.json
COPY apps/api/src/preference/package.json ./apps/api/src/preference/package.json
COPY apps/api/src/replication/package.json ./apps/api/src/replication/package.json
COPY apps/api/src/secret/package.json ./apps/api/src/secret/package.json
COPY apps/api/src/sms/package.json ./apps/api/src/sms/package.json
COPY apps/api/src/status/package.json ./apps/api/src/status/package.json
COPY apps/api/src/storage/package.json ./apps/api/src/storage/package.json
COPY apps/api/src/versioncontrol/package.json ./apps/api/src/versioncontrol/package.json
COPY apps/api/src/function/packages/auth/package.json ./apps/api/src/function/packages/auth/package.json
COPY apps/api/src/function/packages/bucket/package.json ./apps/api/src/function/packages/bucket/package.json
COPY apps/api/src/function/packages/database/package.json ./apps/api/src/function/packages/database/package.json
COPY apps/api/src/function/packages/identity/package.json ./apps/api/src/function/packages/identity/package.json
COPY apps/api/src/function/packages/storage/package.json ./apps/api/src/function/packages/storage/package.json
RUN yarn install --frozen-lockfile --network-timeout 600000

# install app production deps to nodejs image
FROM base AS deps-production
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY libs/core/package.json ./libs/core/package.json
COPY libs/database/package.json ./libs/database/package.json
COPY libs/filter/package.json ./libs/filter/package.json
COPY libs/realtime/package.json ./libs/realtime/package.json
COPY libs/representative/package.json ./libs/representative/package.json
COPY libs/transaction/package.json ./libs/transaction/package.json
COPY libs/interface/package.json ./libs/interface/package.json
COPY apps/api/src/activity/package.json ./apps/api/src/activity/package.json
COPY apps/api/src/asset/package.json ./apps/api/src/asset/package.json
COPY apps/api/src/batch/package.json ./apps/api/src/batch/package.json
COPY apps/api/src/bucket/package.json ./apps/api/src/bucket/package.json
COPY apps/api/src/config/package.json ./apps/api/src/config/package.json
COPY apps/api/src/dashboard/package.json ./apps/api/src/dashboard/package.json
COPY apps/api/src/env_var/package.json ./apps/api/src/env_var/package.json
COPY apps/api/src/function/package.json ./apps/api/src/function/package.json
COPY apps/api/src/mailer/package.json ./apps/api/src/mailer/package.json
COPY apps/api/src/passport/package.json ./apps/api/src/passport/package.json
COPY apps/api/src/preference/package.json ./apps/api/src/preference/package.json
COPY apps/api/src/replication/package.json ./apps/api/src/replication/package.json
COPY apps/api/src/secret/package.json ./apps/api/src/secret/package.json
COPY apps/api/src/sms/package.json ./apps/api/src/sms/package.json
COPY apps/api/src/status/package.json ./apps/api/src/status/package.json
COPY apps/api/src/storage/package.json ./apps/api/src/storage/package.json
COPY apps/api/src/versioncontrol/package.json ./apps/api/src/versioncontrol/package.json
COPY apps/api/src/function/packages/auth/package.json ./apps/api/src/function/packages/auth/package.json
COPY apps/api/src/function/packages/bucket/package.json ./apps/api/src/function/packages/bucket/package.json
COPY apps/api/src/function/packages/database/package.json ./apps/api/src/function/packages/database/package.json
COPY apps/api/src/function/packages/identity/package.json ./apps/api/src/function/packages/identity/package.json
COPY apps/api/src/function/packages/storage/package.json ./apps/api/src/function/packages/storage/package.json
RUN yarn install --frozen-lockfile --production --network-timeout 600000

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
ARG MAILER_URL=""
ARG MONGODB_URL=""
ENV RABBITMQ_URL=$RABBITMQ_URL
ENV MAILER_URL=$MAILER_URL
ENV MONGODB_URL=$MONGODB_URL
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