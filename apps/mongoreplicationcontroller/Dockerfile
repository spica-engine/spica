FROM node:20-buster as base

# install tools to nodejs image
FROM base as tools
RUN apt-get install gnupg
RUN wget -qO - https://www.mongodb.org/static/pgp/server-4.2.asc | apt-key add -
RUN echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/4.2 main" | tee /etc/apt/sources.list.d/mongodb-org-4.2.list
RUN apt-get update && apt-get install -y mongodb-org-shell

# install app deps to nodejs image
FROM base as deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# build app to nodejs image
FROM base as build 
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/mongoreplicationcontroller ./apps/mongoreplicationcontroller
COPY nx.json ./
COPY package.json ./
COPY tsconfig.json ./
RUN yarn nx build mongoreplicationcontroller

# start app from tools, because app executes many mongodb commands
# copy deps and build
FROM tools as runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node","./dist/apps/mongoreplicationcontroller"]