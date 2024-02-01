#!/usr/bin/env bash
set -e

if [ ! -f WORKSPACE ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

if [ $# -eq 0 ]; then
  echo "Please provide a version"
  exit 1
fi

# Authentication
aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin 255353153865.dkr.ecr.eu-central-1.amazonaws.com

# Tag
TAG="$1"

# This is a helper script that builds api and client images locally using bazel and docker

BAZEL=$(yarn bin bazelisk)

echo "Building api image.."
$BAZEL run //stacks/api:image --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release -- --norun

docker image tag bazel/stacks/api:image 255353153865.dkr.ecr.eu-central-1.amazonaws.com/spica-api:$TAG

echo "Pushing api image to ECR.."
docker push 255353153865.dkr.ecr.eu-central-1.amazonaws.com/spica-api:$TAG

echo "Building client code.."
yarn --cwd stacks/spica ng build --prod

echo "Building client image.."
$BAZEL run //stacks/spica --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release -- --norun

docker image tag bazel/stacks/spica:spica 255353153865.dkr.ecr.eu-central-1.amazonaws.com/spica-application:$TAG

echo "Pushing client image to ECR.."
docker push 255353153865.dkr.ecr.eu-central-1.amazonaws.com/spica-application:$TAG


echo "Building mongoreplicationcontroller image.."
$BAZEL run //tools/mongoreplicationcontroller:image --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release -- --norun

docker image tag bazel/tools/mongoreplicationcontroller:image 255353153865.dkr.ecr.eu-central-1.amazonaws.com/mongoreplicationcontroller:$TAG

echo "Pushing mongoreplicationcontroller image to ECR.."
docker push 255353153865.dkr.ecr.eu-central-1.amazonaws.com/mongoreplicationcontroller:$TAG


echo "Building migrate image.."
$BAZEL run //stacks/migrate:image --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release -- --norun

docker image tag bazel/stacks/migrate:image 255353153865.dkr.ecr.eu-central-1.amazonaws.com/migrate:$TAG

echo "Pushing migrate image to ECR.."
docker push 255353153865.dkr.ecr.eu-central-1.amazonaws.com/migrate:$TAG
