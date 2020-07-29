#!/usr/bin/env bash
# Used to bust cache of database

if [ ! -f WORKSPACE ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

echo "$(date)" > ./packages/database/testing/cachebust.txt
source ./scripts/current_version.sh