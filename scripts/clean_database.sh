#!/usr/bin/env bash

if [ ! -f nx.json ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1
fi

rm -rf ./db/.data ./db/.data1 ./db/.data2 ./db/.data3
