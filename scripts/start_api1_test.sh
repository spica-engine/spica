#!/usr/bin/env bash
set -e

export FUNCTION_GRPC_ADDRESS="${GRPC_ADDR:-0.0.0.0:5688}"

exec node apps/api/dist/src/main.js \
  --database-uri "mongodb://localhost:27018/?replicaSet=infra" \
  --database-name "spica_asset_test" \
  --passport-secret "test-secret" \
  --master-key "testmasterkey" \
  --public-url "http://localhost:${PORT:-4300}" \
  --port "${PORT:-4300}" \
  --persistent-path "${PERSISTENT_PATH:-/tmp/spica1}" \
  --function-asset-storage-strategy default \
  --function-asset-path "${FUNCTION_ASSET_PATH:-/tmp/shared-function-assets}" \
  --function-debug
