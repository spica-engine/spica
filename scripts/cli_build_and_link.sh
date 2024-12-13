#!/usr/bin/env bash

if [ ! -f nx.json ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

yarn nx build cli

yarn global add "$(pwd)/dist/apps/cli"

echo "###########################################"
echo "Linking was completed successfully."
echo "You may want to invoke cli by running 'spica' in your terminal"
echo "###########################################"

