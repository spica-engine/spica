# --- begin runfiles.bash initialization v2 ---
# Copy-pasted from the Bazel Bash runfiles library v2.
set -uo pipefail; f=bazel_tools/tools/bash/runfiles/runfiles.bash
source "${RUNFILES_DIR:-/dev/null}/$f" 2>/dev/null || \
source "$(grep -sm1 "^$f " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
source "$0.runfiles/$f" 2>/dev/null || \
source "$(grep -sm1 "^$f " "$0.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
source "$(grep -sm1 "^$f " "$0.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
{ echo>&2 "ERROR: cannot find $f"; exit 1; }; f=; set -e
# --- end runfiles.bash initialization v2 ---


shopt -s expand_aliases

alias spica=$(rlocation $TEST_WORKSPACE/stacks/cli/bin.sh)

echo "## Building local images"

TAG="${TEST_BINARY//\//_}"


docker load -i $(rlocation $TEST_WORKSPACE/stacks/api/image.tar) -q
docker image tag bazel/stacks/api:image spicaengine/api:$TAG

# Client image does not break frequently so we should not waste
# time building it from scratch. instead we pull it from nighty builds
docker pull spicaengine/spica:master -q
docker image tag spicaengine/spica:master spicaengine/spica:$TAG


function assert_not_contains {
    declare OUTPUT="$1"
    declare EXPECTED="$2"
    if [[ $OUTPUT == *"$EXPECTED"* ]]; then
        echo ""
        echo "ASSERTION ERROR"
        echo ""
        echo "EXPECTED" 
        echo ""
        echo $OUTPUT 
        echo ""
        echo "TO NOT CONTAIN"
        echo ""
        echo $EXPECTED
        echo ""
        echo "BUT IT DID."
        echo ""
        exit 1
    fi
}

function assert_contains {
    declare OUTPUT="$1"
    declare EXPECTED="$2"
    if [[ $OUTPUT != *"$EXPECTED"* ]]; then
        echo ""
        echo "ASSERTION ERROR"
        echo ""
        echo "EXPECTED" 
        echo ""
        echo $OUTPUT 
        echo ""
        echo "TO CONTAIN"
        echo ""
        echo $EXPECTED
        echo ""
        echo "BUT IT DID NOT."
        echo ""
        exit 1
    fi
}