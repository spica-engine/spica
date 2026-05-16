#!/usr/bin/env bash
set -e

export FUNCTION_GRPC_ADDRESS="0.0.0.0:5689"

exec node apps/api/dist/src/main.js \
  --database-uri "mongodb://localhost:27018/?replicaSet=infra" \
  --database-name "spica_asset_test" \
  --passport-secret "test-secret" \
  --master-key "testmasterkey" \
  --public-url "http://localhost:4301" \
  --port "4301" \
  --persistent-path "/tmp/spica2" \
  --function-asset-storage-strategy default \
  --function-asset-path "${FUNCTION_ASSET_PATH:-/tmp/shared-function-assets}" \
  --function-debug
