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


# Tag
TAG="$1"

# Build client
BUILD_CLIENT=${2:-false}

# This is a helper script that builds api and client images locally using bazel and docker

BAZEL=$(yarn bin bazelisk)

$BAZEL run //stacks/api:image --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release -- --norun

docker image tag bazel/stacks/api:image spicaengine/api:$TAG

if [ "$BUILD_CLIENT" != false ]; then
 yarn --cwd stacks/spica ng build --prod
fi 

$BAZEL run //stacks/spica --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release -- --norun

docker image tag bazel/stacks/spica:spica spicaengine/spica:$TAG
printf "\033c"
echo "Images build and loaded to docker as  spicaengine/spica:$TAG  and spicaengine/api:$TAG"
echo "to serve an instance with these images, you can use the CLI by invoking the command below in your terminal"
echo ""
echo "spica project start test --image-version=$TAG --image-pull-policy=if-not-present"
echo ""
echo "Alternatively you can publish the image(s) by running;"
echo ""
echo "docker push spicaengine/api:$TAG"
echo ""
echo "docker push spicaengine/spica:$TAG"