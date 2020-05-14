#!/usr/bin/env bash
set -u -e -o pipefail

echo "Building the database and dashboard package"
yarn bazel build //stacks/api/function/packages/database:package //stacks/api/function/packages/dashboard:package

OUTPUT=`mktemp -d`;

mkdir "$OUTPUT/database"

cp -r ./bazel-bin/stacks/api/function/packages/database/package/* "$OUTPUT/database"
(cd "$OUTPUT/database" && sudo npm link)

mkdir "$OUTPUT/dashboard"

cp -r ./bazel-bin/stacks/api/function/packages/dashboard/package/* "$OUTPUT/dashboard"
(cd "$OUTPUT/dashboard" && sudo npm link)

echo "Now you please provide the directory of function which you want install this package locally.";
echo "It should be something like this '/private/tmp/functions'"
read -p "Path: " FUNCTION_PATH || exit 1

cd $FUNCTION_PATH

for DIR in */
do
  (cd "./$DIR" && sudo npm link @spica-devkit/database)
  (cd "./$DIR" && sudo npm link @spica-devkit/dashboard)
done