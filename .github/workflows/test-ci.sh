#!/bin/bash
COMMANDS=(
"format:check"
"build:cli"
"build:devkit:*"
"build-image:api"
"build-image:migrate"
"build-image:mongoreplicationcontroller"
"test:cli"
"test:devkit:*"
"test-image:migrate"
"test-image:api --build-arg PROJECTS=api/activity/**"
"test-image:api --build-arg PROJECTS=api/asset/**"
"test-image:api --build-arg PROJECTS=api/bucket"
"test-image:api --build-arg PROJECTS=api/bucket/cache"
"test-image:api --build-arg PROJECTS=api/bucket/common"
"test-image:api --build-arg PROJECTS=api/bucket/expression"
"test-image:api --build-arg PROJECTS=api/bucket/graphql"
"test-image:api --build-arg PROJECTS=api/bucket/history"
"test-image:api --build-arg PROJECTS=api/bucket/hooks"
"test-image:api --build-arg PROJECTS=api/bucket/realtime"
"test-image:api --build-arg PROJECTS=api/bucket/schemas-realtime"
"test-image:api --build-arg PROJECTS=api/bucket/services"
"test-image:api --build-arg PROJECTS=api/dashboard/**"
"test-image:api --build-arg PROJECTS=api/function"
"test-image:api --build-arg PROJECTS=api/function/enqueuer --build-arg RABBITMQ_URL=amqp://172.17.0.1:5672"
"test-image:api --build-arg PROJECTS=api/function/** --build-arg EXCLUDE='api/function/packages/**api/functionapi/function/enqueuer'"
"test-image:api --build-arg PROJECTS=api/passport/** --build-arg EXCLUDE='api/passport/apikey/**api/passport/identity/**'"
"test-image:api --build-arg PROJECTS=api/passport/apikey/**"
"test-image:api --build-arg PROJECTS=api/passport/identity/**"
"test-image:api --build-arg PROJECTS=api/preference/**"
"test-image:api --build-arg PROJECTS=api/replication/**"
"test-image:api --build-arg PROJECTS=api/status/**"
"test-image:api --build-arg PROJECTS=api/storage/**"
"test-image:api --build-arg PROJECTS=api/versioncontrol/**"
"test-image:api --build-arg PROJECTS=core/**"
"test-image:api --build-arg PROJECTS=database/**"
"test-image:api --build-arg PROJECTS=filter/**"
)

for command in "${COMMANDS[@]}"; do
    echo "------ Running command: $command ------"
    if ! yarn "$command"; then
        echo "X Command failed: $command"
        exit 1
    fi
    echo "v Command succeeded: $command"
done