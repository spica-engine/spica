#!/usr/bin/env bash

if [ ! -f nx.json ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

yarn nx bundle cli

npm install -g "$(pwd)/apps/cli/dist"

echo "###########################################"
echo "Linking was completed successfully."
echo "You may want to invoke cli by running 'spica' in your terminal"
echo "###########################################"