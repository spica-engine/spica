#!/usr/bin/env bash

if [ ! -f nx.json ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

mkdir -p ./db/.data1 ./db/.data2 ./db/.data3
mongod --port 27017 --bind_ip_all --dbpath ./db/.data1 --replSet infra & PID1="$!"
mongod --port 27018 --bind_ip_all --dbpath ./db/.data2 --replSet infra & PID2="$!"
mongod --port 27019 --bind_ip_all --dbpath ./db/.data3 --replSet infra & PID3="$!"
echo "Waiting for the nodes to become ready."
sleep 10 && mongosh --port 27017 --eval '
rs.initiate(
   {
      _id: "infra",
      members: [
         { _id: 0, host : "localhost:27017" },
         { _id: 1, host : "localhost:27018" },
         { 
            _id: 2, 
            host : "localhost:27019",
            priority : 0,
            slaveDelay: 5,
            tags: { slaveDelay: "true" }
         }
      ]
   }
)
'
trap "kill $PID1 $PID2 $PID3" exit INT TERM
wait