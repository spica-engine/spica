#!/usr/bin/env bash
set -u -e -o pipefail

echo "Building devkit packages"
yarn run build:devkit:*

echo "Now please provide the root directory of functions which you want install these packages locally."
echo "If you leave empty /private/tmp/functions will be used as default"
read -p "Path: " FUNCTION_PATH
FUNCTION_PATH=${FUNCTION_PATH:=/private/tmp/functions}

for DIR in $FUNCTION_PATH/*; do
  DATABASE_PATH="$DIR/node_modules/@spica-devkit/database"
  BUCKET_PATH="$DIR/node_modules/@spica-devkit/bucket"
  IDENTITY_PATH="$DIR/node_modules/@spica-devkit/identity"
  STORAGE_PATH="$DIR/node_modules/@spica-devkit/storage"

  (mkdir -p $DATABASE_PATH && rsync -ar --no-owner --no-group ./dist/apps/api/src/function/packages/database/* $DATABASE_PATH)
  (cd $DATABASE_PATH && npm install)
  (mkdir -p $BUCKET_PATH && rsync -ar --no-owner --no-group ./dist/apps/api/src/function/packages/bucket/* $BUCKET_PATH)
  (cd $BUCKET_PATH && npm install)
  (mkdir -p $IDENTITY_PATH && rsync -ar --no-owner --no-group ./dist/apps/api/src/function/packages/identity/* $IDENTITY_PATH)
  (cd $IDENTITY_PATH && npm install)
  (mkdir -p $STORAGE_PATH && rsync -ar --no-owner --no-group ./dist/apps/api/src/function/packages/storage/* $STORAGE_PATH)
  (cd $STORAGE_PATH && npm install)
done
