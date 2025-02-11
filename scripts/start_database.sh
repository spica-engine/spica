#!/usr/bin/env bash

if [ ! -f nx.json ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

mkdir -p ./db/.data
mongod --bind_ip localhost --dbpath ./db/.data --replSet infra & PID="$!"
echo "Waiting for the mongodb instance to start up."
sleep 5 && mongo --eval 'rs.initiate()'

trap "kill $PID" exit INT TERM
wait
