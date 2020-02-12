# Start mongodb with three repl.
# One of them has slave delay configuration
sudo mkdir -p /data/node1 /data/node2 /data/node3
sudo chown -R $USER /data/
mongod --port 27017 --bind_ip_all --dbpath /data/node1 --replSet infra & PID1="$!"
mongod --port 27018 --bind_ip_all --dbpath /data/node2 --replSet infra & PID2="$!"
mongod --port 27019 --bind_ip_all --dbpath /data/node3 --replSet infra & PID3="$!"
sleep 10 && mongo --port 27017 --eval '
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

# For first initialization you need to follow steps described below
# Open mongo terminal by typing `mongo`
# Type rs.initiate()
# Type rs.add("localhost:27018")

# And you ready to go!
