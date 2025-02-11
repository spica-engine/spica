FROM node:22-bullseye AS base

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
COPY nx.json ./
COPY package.json ./
COPY tsconfig.json ./
COPY yarn.lock ./
RUN yarn run build:migrate

FROM base AS test
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/migrate ./apps/migrate
COPY nx.json ./
COPY package.json ./
COPY tsconfig.json ./
COPY yarn.lock ./
COPY jest.flaky.setup.js ./
COPY jest.preset.js ./
COPY jest.setup.js ./
COPY libs/database ./libs/database
RUN yarn run test:migrate

# start app from tools, because app executes many mongodb commands
# copy deps and build
FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node","./dist/apps/migrate"]
