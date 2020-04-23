#!/usr/bin/env bash

if [ ! -f WORKSPACE ]; then
    echo "###############################################"
    echo "Please run this script from the workspace root."
    echo "###############################################"
    exit 1;
fi

readonly GCS_BUCKET=gs://spica-charts
readonly REPOSITORY_URL=https://spica-charts.storage.googleapis.com
readonly OUT_DIR=./dist/charts

# Clean up
rm -rf $OUT_DIR
mkdir -p $OUT_DIR

# Get current index.yaml from the repository
gsutil cp "$GCS_BUCKET/index.yaml" "$OUT_DIR/index.yaml"

# Stamp chart
yarn bazel build //charts:spica --config=release

# Re-package stamped package
helm package --destination $OUT_DIR ./bazel-bin/charts/spica/charts/spica

# Generate updated index file by merging it with the old one from the repository
helm repo index --url $REPOSITORY_URL --merge "$OUT_DIR/index.yaml" $OUT_DIR

# Recursively sync output directory to gcs bucket
gsutil -m rsync $OUT_DIR $GCS_BUCKET