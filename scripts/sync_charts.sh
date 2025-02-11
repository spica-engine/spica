#!/usr/bin/env bash

if [ ! -f nx.json ]; then
    echo "###############################################"
    echo "Please run this script from the workspace root."
    echo "###############################################"
    exit 1
fi

readonly GCS_BUCKET=gs://spica-charts
readonly REPOSITORY_URL=https://spica-charts.storage.googleapis.com
readonly OUT_DIR=./dist/charts

if [ -z "$VERSION" ]; then
    VERSION=$(git describe --tags --abbrev=0)
fi

echo "VERSION is set to: $VERSION"

# Clean up
rm -rf charts-${VERSION}
mkdir charts-${VERSION}

rm -rf $OUT_DIR
mkdir -p $OUT_DIR

# Get current index.yaml from the repository
gsutil cp "$GCS_BUCKET/index.yaml" "$OUT_DIR/index.yaml"

# Substitute placeholder with current version
cp -R charts/* charts-${VERSION}
sed -i "s/0.0.0-PLACEHOLDER/${VERSION}/g" charts-${VERSION}/spica/Chart.yaml

# Re-package substituted package
helm package --destination $OUT_DIR ./charts-${VERSION}/spica

# Generate updated index file by merging it with the old one from the repository
helm repo index --url $REPOSITORY_URL --merge "$OUT_DIR/index.yaml" $OUT_DIR

# Recursively sync output directory to gcs bucket
gsutil -m rsync $OUT_DIR $GCS_BUCKET
