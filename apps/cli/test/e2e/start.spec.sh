source $1 $@

echo "## Serving a spica instance"

NAME="${TAG//_/-}"

# FD 5
exec 5>&1

OUTPUT=$(spica project start $NAME --force --image-version=$TAG --port=5791 --image-pull-policy=if-not-present --retain-volumes=false --no-open 2>&1 | tee /dev/fd/5; exit ${PIPESTATUS[0]})

echo "spica project start $NAME --force --image-version=$TAG --port=5791 --image-pull-policy=if-not-present --retain-volumes=false --no-open"

assert_contains "$OUTPUT" "Pulling images" 
assert_contains "$OUTPUT" "Creating an ingress to route traffic."
assert_contains "$OUTPUT" "Spica $NAME is serving on http://localhost"

echo "## Waiting for a few seconds to let the server become available"
sleep 20
echo "## Checking if the server available"
echo ""

PORT_REGEX='on http:\/\/localhost\:([0-9]+)'

if [[ "$OUTPUT" =~ $PORT_REGEX ]] 
    then 
        PORT=${BASH_REMATCH[1]}
    else 
        echo "Could not find the port."
        exit 1
    fi

OUTPUT="$(docker run --network host --rm curlimages/curl curl -s -w '%{http_code} %{content_type}'  http://localhost:$PORT/api/bucket | tee /dev/fd/5; exit ${PIPESTATUS[0]})"

assert_contains "$OUTPUT" "401"
assert_contains "$OUTPUT" "application/json"

echo ""
echo "## All tests have passed. Cleaning"
echo ""

spica project remove $NAME --retain-volumes=false
