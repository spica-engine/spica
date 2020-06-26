#!/usr/bin/env bash
set -u -e -o pipefail

echo "Building the database and dashboard package"
yarn bazel build //stacks/api/function/packages/database:package //stacks/api/function/packages/dashboard:package

(cd "./bazel-bin/stacks/api/function/packages/dashboard/package")
(cd "./bazel-bin/stacks/api/function/packages/database/package")

echo "Now please provide the root directory of functions which you want install these packages locally.";
echo "If you leave empty /private/tmp/functions will be used as default"
read -p "Path: " FUNCTION_PATH
FUNCTION_PATH=${FUNCTION_PATH:=/private/tmp/functions}


for DIR in $FUNCTION_PATH/*
do
  DASHBOARD_PATH="$DIR/node_modules/@spica-devkit/dashboard"
  DATABASE_PATH="$DIR/node_modules/@spica-devkit/database"
  (mkdir -p $DASHBOARD_PATH && rsync -ar --no-owner --no-group ./bazel-bin/stacks/api/function/packages/dashboard/package/* $DASHBOARD_PATH)
  (cd $DASHBOARD_PATH && npm install)
  (mkdir -p $DATABASE_PATH && rsync -ar --no-owner --no-group ./bazel-bin/stacks/api/function/packages/database/package/* $DATABASE_PATH)
  (cd $DATABASE_PATH && npm install)
done
