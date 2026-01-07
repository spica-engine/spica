FROM node:22-slim AS base

# install app deps to nodejs image
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# build app to nodejs image
FROM base AS build 
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/migrate ./apps/migrate
COPY nx.json package.json tsconfig.json yarn.lock ./
RUN yarn run build:migrate

FROM base AS test
WORKDIR /app
# for mongo memory server
RUN apt-get update && apt-get install libcurl4 -y
COPY --from=deps /app/node_modules ./node_modules
COPY apps/migrate ./apps/migrate
COPY nx.json package.json tsconfig.json yarn.lock ./
COPY jest.flaky.setup.js jest.preset.js jest.setup.js ./
COPY libs/database ./libs/database
COPY libs/interface/database ./libs/interface/database
COPY *.env ./
ARG MONGODB_URL=""
ENV MONGODB_URL=$MONGODB_URL
RUN yarn run test:migrate

# copy deps and build
FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node","./dist/apps/migrate/src/main.js"]
