#!/usr/bin/env bash

set -u -e -o pipefail

if [ ! -f WORKSPACE ]; then
  echo "###########################################"
  echo "Please run this script from workspace root."
  echo "###########################################"
  exit 1
fi

if [ $# -eq 0 ]; then
  echo "Please provide a tag. (next, latest)"
  exit 1
fi

# Tag
TAG="$1"

# We need to resolve the Bazel binary in the node modules because running Bazel
# through `yarn bazel` causes additional output that throws off the command stdout.
BAZEL_BIN=$(yarn bin bazelisk)

# Build into a distinct output location so that artifacts from previous builds are not reused
BAZEL_OUTPUT_BASE=$(mktemp -d -t spica-release-next.XXXXXXX)
BAZEL="$BAZEL_BIN --output_base=$BAZEL_OUTPUT_BASE"

echo ""
echo "## Publishing $TAG"
rm -rf ./dist

echo ""
echo "## Version information"
./scripts/current_version.sh

echo ""
echo "## Using bazel binary"
echo $BAZEL

echo ""
echo "## Bazel targets to publish"
# Docker packages
DOCKER_IMAGE_LABELS=$($BAZEL query --output=label --noshow_progress 'attr("tags", "\[.*release-with-spica.*\]", //stacks/... + //tools/...) intersect kind("container_push", //stacks/... + //tools/...)')

# Npm packages
# NPM_PACKAGE_LABELS=`$BAZEL query --output=label --noshow_progress 'attr("tags", "\[.*release-with-spica.*\]", //stacks/...) intersect kind("pkg_.*", //stacks/...)'`

echo $DOCKER_IMAGE_LABELS

# Once we migrate client to bazel we'll get rid of these steps
echo ""
echo "## Building spica"
yarn --cwd=stacks/spica --silent ng build --prod --progress=false

# echo ""
# echo "## Building bazel generated artifacts in parallel"
# $BAZEL build --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --noshow_progress --config=release $NPM_PACKAGE_LABELS $DOCKER_IMAGE_LABELS

# Publish docker images
for IMAGE_LABEL in $DOCKER_IMAGE_LABELS; do
  echo "** Publishing $IMAGE_LABEL"
  $BAZEL run --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release $IMAGE_LABEL
  # We are overriding stamp vars because container_push does not support multiple tags
  BUILD_SCM_VERSION_OVERRIDE=$TAG $BAZEL run --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release $IMAGE_LABEL
done

# # Publish npm packages
# for PACKAGE_LABEL in $NPM_PACKAGE_LABELS; do
#   echo "** Publishing $PACKAGE_LABEL"
#   $BAZEL run ${PACKAGE_LABEL}.publish --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release -- --access public --tag $1
# done

echo ""
echo "## Publishing Helm charts"
source ./scripts/sync_charts.sh
