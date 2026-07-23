#!/usr/bin/env bash

# Starts the API with the default (local filesystem) function asset storage strategy.
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
PUBLIC_URL="${PUBLIC_URL:-http://localhost:4300}"
MASTER_KEY="${MASTER_KEY:-localdevmasterkey}"
PASSPORT_SECRET="${PASSPORT_SECRET:-local-dev-secret}"
PERSISTENT_PATH="${PERSISTENT_PATH:-/tmp/spica}"
FUNCTION_ASSET_PATH="${FUNCTION_ASSET_PATH:-$PERSISTENT_PATH/function-assets}"

mkdir -p "$PERSISTENT_PATH"

FUNCTION_SPAWN_ENTRYPOINT_PATH="${FUNCTION_SPAWN_ENTRYPOINT_PATH:-packages/api/function/runtime/node/dist/bootstrap/entrypoint.js}"
FUNCTION_TS_COMPILER_PATH="${FUNCTION_TS_COMPILER_PATH:-packages/api/function/builder/legacy/dist/src/typescript_worker.js}"
FUNCTION_GRPC_ADDRESS="${FUNCTION_GRPC_ADDRESS:-0.0.0.0:5688}"

echo "Starting API — function asset storage: default (local filesystem)"
echo "  Database : $DATABASE_URI / $DATABASE_NAME"
echo "  Public URL: $PUBLIC_URL"
echo "  Persistent: $PERSISTENT_PATH"
echo ""

FUNCTION_SPAWN_ENTRYPOINT_PATH="$FUNCTION_SPAWN_ENTRYPOINT_PATH" \
FUNCTION_TS_COMPILER_PATH="$FUNCTION_TS_COMPILER_PATH" \
FUNCTION_GRPC_ADDRESS="$FUNCTION_GRPC_ADDRESS" \
node "$ENTRY" \
  --database-uri "$DATABASE_URI" \
  --database-name "$DATABASE_NAME" \
  --passport-secret "$PASSPORT_SECRET" \
  --master-key "$MASTER_KEY" \
  --public-url "$PUBLIC_URL" \
  --port 4300 \
  --persistent-path "$PERSISTENT_PATH" \
  --function-asset-storage-strategy default \
  --function-asset-path "$FUNCTION_ASSET_PATH"
