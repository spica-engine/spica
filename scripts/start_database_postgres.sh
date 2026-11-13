#!/usr/bin/env bash

if [ ! -f nx.json ]; then
    echo "###########################################"
    echo "Please run this script from workspace root."
    echo "###########################################"
    exit 1;
fi

CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-spica-postgres}"
IMAGE="${POSTGRES_IMAGE:-spica-postgres:dev}"
PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-spica}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-spica}"
POSTGRES_DB="${POSTGRES_DB:-spica}"
DATA_DIR="$(pwd)/db/.pgdata"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Building $IMAGE (stock postgres plus pg_cron)."
    docker build -t "$IMAGE" ./docker/postgres || exit 1
fi

mkdir -p "$DATA_DIR"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1

docker run --name "$CONTAINER_NAME" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -p "127.0.0.1:$PORT:5432" \
    -v "$DATA_DIR:/var/lib/postgresql" \
    "$IMAGE" \
    postgres \
    -c shared_preload_libraries=pg_cron \
    -c cron.use_background_workers=on \
    -c cron.database_name="$POSTGRES_DB" &
PID="$!"

trap "docker stop $CONTAINER_NAME >/dev/null 2>&1; kill $PID 2>/dev/null" EXIT INT TERM

echo "Waiting for the postgresql instance to start up."
until docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
    sleep 1
done

echo "PostgreSQL is ready. Start the API with:"
echo "  --database-type postgresql --database-uri postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$PORT/$POSTGRES_DB"

wait
