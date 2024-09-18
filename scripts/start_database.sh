#!/usr/bin/env bash

if [ ! -f WORKSPACE ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

mkdir -p ./dist/.data
mongod --bind_ip localhost --dbpath ./dist/.data --replSet infra & PID="$!"
echo "Waiting for the mongodb instance to start up."
sleep 5 && mongosh --eval 'rs.initiate()'

trap "kill $PID" exit INT TERM
wait
