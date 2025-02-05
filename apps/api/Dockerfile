FROM node:22-bullseye AS base

# install app deps to nodejs image
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/package.json
RUN yarn install --frozen-lockfile

# build app to nodejs image
FROM base AS build 
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api ./apps/api
COPY libs ./libs
COPY nx.json ./
COPY package.json ./
COPY tsconfig.json ./
COPY yarn.lock ./
RUN yarn nx compile api

FROM base AS test
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api ./apps/api
COPY libs ./libs
COPY nx.json ./
COPY package.json ./
COPY tsconfig.json ./
COPY yarn.lock ./
COPY jest.flaky.setup.js ./
COPY jest.preset.js ./
COPY jest.setup.js ./
COPY *.env ./
RUN yarn test:api

# start app from tools, because app executes many mongodb commands
# copy deps and build
FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node","./dist/apps/api/src/main.js"]