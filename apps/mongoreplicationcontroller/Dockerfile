FROM node:22-bookworm AS base

FROM mongodb/mongodb-community-server:7.0.0-ubi8

# install tools to nodejs image
FROM base AS tools
RUN apt-get install gnupg


# install app deps to nodejs image
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# build app to nodejs image
FROM deps AS build 
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/mongoreplicationcontroller ./apps/mongoreplicationcontroller
COPY nx.json ./
COPY package.json ./
COPY tsconfig.json ./
RUN yarn nx build mongoreplicationcontroller --verbose

# start app from tools, because app executes many mongodb commands
# copy deps and build
FROM tools AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node","./dist/apps/mongoreplicationcontroller"]