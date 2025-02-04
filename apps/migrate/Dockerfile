FROM node:22-bullseye AS base

# install tools to nodejs image
FROM base AS tools
RUN apt-get install gnupg curl
RUN curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
RUN echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bullseye/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
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
COPY apps/migrate ./apps/migrate
COPY nx.json ./
COPY package.json ./
COPY tsconfig.json ./
COPY yarn.lock ./
RUN yarn nx build migrate

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
RUN yarn nx test migrate

# start app from tools, because app executes many mongodb commands
# copy deps and build
FROM tools AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node","./dist/apps/migrate"]