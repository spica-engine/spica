#!/bin/bash

# Test MongoDB CI setup locally and run a specific test in Docker (like CI)
# Usage: ./scripts/test_local_ci_setup.sh [projects-pattern]
# Example: ./scripts/test_local_ci_setup.sh api/passport/apikey/**

set -e

PROJECTS=${1:-"api/passport/apikey/**"}

echo "🧪 Local CI Setup Test (Docker)"
echo "================================"
echo "Projects: $PROJECTS"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  docker stop mongodb 2>/dev/null || true
  echo "✅ Cleanup complete"
}

# Register cleanup on exit
trap cleanup EXIT

echo "📦 Starting MongoDB container (same as CI)..."
docker run -d --rm --name mongodb \
  -p 27017:27017 \
  mongo:7.0.14 \
  --replSet testset --bind_ip_all

echo ""
echo "⏳ Waiting for MongoDB to start..."
for i in {1..30}; do
  if docker exec mongodb mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
    echo "✅ MongoDB is ready!"
    break
  fi
  echo "   Attempt $i: MongoDB not ready yet, waiting..."
  sleep 2
done

echo ""
echo "🔧 Initializing replica set..."
docker exec mongodb mongosh --eval "rs.initiate({_id: 'testset', members: [{_id: 0, host: 'localhost:27017'}]})"

echo ""
echo "⏳ Waiting for replica set to stabilize..."
sleep 5

echo ""
echo "🔍 Verifying replica set status..."
docker exec mongodb mongosh --eval "rs.status()" | head -20

echo ""
echo "✅ MongoDB replica set is ready!"
echo ""

# MongoDB URL for Docker-to-Docker communication (like CI)
# NOTE: Using 172.17.0.1 for Docker-to-Docker (test container → MongoDB container)
MONGODB_URL="mongodb://172.17.0.1:27017/?replicaSet=testset&directConnection=true&retryWrites=false"

echo "🔗 MongoDB connection details:"
echo "   URL: $MONGODB_URL"
echo "   Note: Using '172.17.0.1' for Docker-to-Docker communication (same as CI)"
echo ""

echo "🐳 Running test-image:api in Docker (same as CI)..."
echo "   Projects: $PROJECTS"
echo "   MongoDB URL: $MONGODB_URL"
echo ""

# Call docker build directly (bypassing Nx to have full control)
# This matches the command in apps/api/project.json but with our custom build args
echo "   Running: docker build --target test --platform=linux/amd64 . -f ./apps/api/Dockerfile \\"
echo "            --build-arg PROJECTS=$PROJECTS \\"
echo "            --build-arg MONGODB_URL=$MONGODB_URL \\"
echo "            --no-cache --progress=plain"
echo ""

# Run docker build directly with --no-cache to force rebuild
docker build --target test --platform=linux/amd64 . -f ./apps/api/Dockerfile \
  --build-arg "PROJECTS=$PROJECTS" \
  --build-arg "MONGODB_URL=$MONGODB_URL" \
  --no-cache \
  --progress=plain

echo ""
echo "✅ Test completed successfully!"
echo ""
