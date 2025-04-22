FROM node:22-slim AS base

# install tools to nodejs image
FROM base AS tools
RUN apt-get update && apt-get install gnupg curl -y
RUN curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
RUN echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
RUN apt-get update && apt-get install -y mongodb-org

# install app deps to nodejs image
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# build app to nodejs image
FROM base AS build 
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/mongoreplicationcontroller ./apps/mongoreplicationcontroller
COPY nx.json ./
COPY package.json ./
COPY tsconfig.json ./
COPY yarn.lock ./
RUN yarn run build:mongoreplicationcontroller

# start app from tools, because app executes many mongodb commands
# copy deps and build
FROM tools AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node","./dist/apps/mongoreplicationcontroller"]