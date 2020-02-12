#!/usr/bin/env bash

set -u -e -o pipefail


if [ $# -eq 0 ]
then
  echo "Please provide a tag. (next, latest)"
  exit 1
fi

# Tag
TAG="$1"

echo "Publishing ${TAG}".

# We need to resolve the Bazel binary in the node modules because running Bazel
# through `yarn bazel` causes additional output that throws off the command stdout.
BAZEL_BIN=$(yarn bin)/bazel

# Build into a distinct output location so that artifacts from previous builds are not reused
BAZEL_OUTPUT_BASE=$(mktemp -d -t spica-release-next.XXXXXXX)
BAZEL="$BAZEL_BIN"

# Docker packages
DOCKER_IMAGE_LABELS=`${BAZEL_BIN} query --output=label 'attr("tags", "\[.*release-with-spica.*\]", //stacks/... + //tools/... + //docs/...) intersect kind("container_push", //stacks/... + //tools/... + //docs/...)'`

# Npm packages
NPM_PACKAGE_LABELS=`${BAZEL_BIN} query --output=label 'attr("tags", "\[.*release-with-spica.*\]", //stacks/...) intersect kind(".*_package", //stacks/...)'`

echo "Publishing"

# Once we migrate client to bazel we'll get rid of this
echo "Building spica"
cd stacks/spica
yarn ng build @spica-client/common &> /dev/null  &
yarn ng build @spica-client/core &> /dev/null &
yarn ng build @spica-client/material &> /dev/null &
wait
yarn ng build --prod &> /dev/null &


echo "Building site and docs"
cd ../.. && yarn docs
cd docs/site yarn ng build --prod &> /dev/null &
wait

echo "Bazel targets to publish"
echo $DOCKER_IMAGE_LABELS + $NPM_PACKAGE_LABELS

# Build all npm packages and docker packages in parallel
$BAZEL build --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release $NPM_PACKAGE_LABELS $DOCKER_IMAGE_LABELS

# Publish docker images
for IMAGE_LABEL in $DOCKER_IMAGE_LABELS; do
  $BAZEL run --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release $IMAGE_LABEL
  # Override stamp vars because container_push does not support multiple tags
  BUILD_SCM_VERSION_OVERRIDE=$TAG $BAZEL run --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release $IMAGE_LABEL
done

# Publish npm packages
for PACKAGE_LABEL in $NPM_PACKAGE_LABELS; do
  $BAZEL run -- ${PACKAGE_LABEL}.publish --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release --access public --tag $1
done
