#!/usr/bin/env bash

# Starts two API replicas locally for testing replication.
# Requires the API to be built first: yarn build:api
# Requires MongoDB running as a replica set: scripts/start_database.sh

if [ ! -f nx.json ]; then
  echo "###########################################"
  echo "Please run this script from workspace root."
  echo "###########################################"
  exit 1
fi

ENTRY="apps/api/dist/src/main.js"

if [ ! -f "$ENTRY" ]; then
  echo "Build not found at $ENTRY. Run 'yarn build:api' first."
  exit 1
fi

DATABASE_URI="${DATABASE_URI:-mongodb://localhost:27017/?replicaSet=infra}"
DATABASE_NAME="${DATABASE_NAME:-spica}"
PUBLIC_URL_1="${PUBLIC_URL_1:-http://localhost:4300}"
PUBLIC_URL_2="${PUBLIC_URL_2:-http://localhost:4301}"
MASTER_KEY="${MASTER_KEY:-localdevmasterkey}"

PERSISTENT_PATH_1="/tmp/spica-1"
PERSISTENT_PATH_2="/tmp/spica-2"

mkdir -p "$PERSISTENT_PATH_1" "$PERSISTENT_PATH_2"

echo "Starting API replica 1 on port 4300 (gRPC trigger: 50051, worker: 5688) → $PERSISTENT_PATH_1"
FUNCTION_GRPC_ADDRESS="0.0.0.0:5688" node "$ENTRY" \
  --database-uri "$DATABASE_URI" \
  --database-name "$DATABASE_NAME" \
  --public-url "$PUBLIC_URL_1" \
  --master-key "$MASTER_KEY" \
  --port 4300 \
  --grpc-function-port 50051 \
  --persistent-path "$PERSISTENT_PATH_1" \
  --replication true \
  &
PID1=$!

echo "Starting API replica 2 on port 4301 (gRPC trigger: 50052, worker: 5689) → $PERSISTENT_PATH_2"
FUNCTION_GRPC_ADDRESS="0.0.0.0:5689" node "$ENTRY" \
  --database-uri "$DATABASE_URI" \
  --database-name "$DATABASE_NAME" \
  --public-url "$PUBLIC_URL_2" \
  --master-key "$MASTER_KEY" \
  --port 4301 \
  --grpc-function-port 50052 \
  --persistent-path "$PERSISTENT_PATH_2" \
  --replication true \
  &
PID2=$!

echo "Both replicas running. PIDs: $PID1, $PID2"
echo "Press Ctrl+C to stop both."

trap "echo 'Stopping...'; kill $PID1 $PID2" EXIT INT TERM
wait
