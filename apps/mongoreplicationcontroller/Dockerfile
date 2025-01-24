FROM ubuntu:22.04 AS base

# install tools to nodejs image
FROM base AS tools
RUN apt-get update && apt-get install gnupg curl -y

RUN curl -sL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
RUN bash nodesource_setup.sh
RUN apt-get install -y nodejs

RUN curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
RUN echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
RUN apt-get update && install -y mongodb-org
CMD ["mongo", "--version"]

# install app deps to nodejs image
# FROM base AS deps
# WORKDIR /app
# COPY package.json yarn.lock ./
# RUN apt-get update && apt-get install -y npm
# RUN npm install -g yarn
# RUN yarn install --frozen-lockfile

# # build app to nodejs image
# FROM deps AS build 
# WORKDIR /app
# COPY --from=deps /app/node_modules ./node_modules
# COPY apps/mongoreplicationcontroller ./apps/mongoreplicationcontroller
# COPY nx.json ./
# COPY package.json ./
# COPY tsconfig.json ./
# RUN yarn nx build mongoreplicationcontroller --verbose

# # start app from tools, because app executes many mongodb commands
# # copy deps and build
# FROM tools AS runner
# WORKDIR /app
# COPY --from=deps /app/node_modules ./node_modules
# COPY --from=build /app/dist ./dist
# ENTRYPOINT ["node","./dist/apps/mongoreplicationcontroller"]