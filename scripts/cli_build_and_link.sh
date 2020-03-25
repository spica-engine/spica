#!/usr/bin/env bash

if [ ! -f WORKSPACE ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

yarn bazel build //stacks/cli:package

(cd ./bazel-bin/stacks/cli/package && yarn link)

yarn link @spica/cli

echo "###########################################"
echo "Linking was completed successfully."
echo "You may want to invoke cli by running 'spica' in your terminal"
echo "###########################################"

