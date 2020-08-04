set +e

source $1 $@

echo "## Serving a spica instance"

NAME="${TAG//_/-}"

OUTPUT="$(spica serve $NAME --force --version=$TAG --image-pull-policy=if-not-present --no-open 2>&1)"

assert_partially "$OUTPUT" "Pulling images" 
assert_partially "$OUTPUT" "Creating an ingress to route traffic."
assert_partially "$OUTPUT" "Spica $NAME is serving on http://localhost"

echo $OUTPUT

PORT_REGEX='on http:\/\/localhost\:([0-9]+)'

if [[ "$OUTPUT" =~ $PORT_REGEX ]] 
    then 
        PORT=${BASH_REMATCH[1]}
    else 
        echo "Could not find the port."
        exit 1
    fi


OUTPUT="$(docker run --network host --rm curlimages/curl curl -w '%{http_code} %{content_type}'  http://localhost:$PORT/api/bucket)"

assert_partially "$OUTPUT" "401"
assert_partially "$OUTPUT" "application/json"

echo "## All tests have passed. Cleaning"
spica rm $NAME