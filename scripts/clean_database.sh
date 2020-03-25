#!/usr/bin/env bash

if [ ! -f WORKSPACE ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

rm -rf ./dist/.data ./dist/.data1 ./dist/.data2 ./dist/.data3