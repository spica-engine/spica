#!/usr/bin/env bash

set -u -e -o pipefail

echo "Building the database package"
yarn bazel build //stacks/api/function/packages/database:package

OUTPUT=`mktemp -d`;

cp -r ./bazel-bin/stacks/api/function/packages/database/package/* $OUTPUT
(cd $OUTPUT && sudo npm link)

echo "Now you please provide the directory of function which you want install this package locally.";
echo "It should be something like this '/private/tmp/functions/5e5e59557c3782b14c25ed09'"
read -p "Path: " FUNCTION_PATH || exit 1

cd $FUNCTION_PATH

for DIR in */
do
  (cd "./$DIR" && sudo npm link @spica-devkit/database)
done


