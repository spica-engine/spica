# Selects between two build strategies:
#   inside   (default) - TypeScript is compiled inside Docker; useful for local builds.
#   prebuilt (CI)      - dist/ is pre-built on the host by `yarn run build:api` before
#                        docker build runs. Docker just packages the output. Much faster.
# Must be declared before the first FROM to be usable in later FROM instructions.
ARG BUILD_STRATEGY=inside

FROM node:22-slim AS base
ENV NX_FORCE_NO_DAEMON=true

# install necessary tools
FROM base AS tools
RUN apt-get update && apt-get install git -y

# install app deps to nodejs image
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/package.json
RUN yarn install --frozen-lockfile --network-timeout 600000

# install app production deps to nodejs image
FROM base AS deps-production
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/package.json
RUN yarn install --frozen-lockfile --production --network-timeout 600000

# Strategy: inside — compile TypeScript inside Docker (default, local use)
FROM base AS build-inside
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api ./apps/api
COPY libs ./libs
COPY nx.json package.json tsconfig.json yarn.lock ./
RUN node -e "const fs=require('fs'),c=JSON.parse(fs.readFileSync('tsconfig.json','utf-8'));c.compilerOptions.sourceMap=false;fs.writeFileSync('tsconfig.json',JSON.stringify(c,null,2));"
RUN yarn run build:api

# Strategy: prebuilt — accept dist/ compiled by the CI runner before docker build.
# Requires `yarn run build:api` to have run on the host before invoking docker build.
FROM scratch AS build-prebuilt
COPY dist /app/dist

# Unify: the runner always copies from this stage regardless of strategy
FROM build-${BUILD_STRATEGY} AS build

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