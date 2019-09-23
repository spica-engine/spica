function onError {
    echo "Failed to execute: $0"
    echo ""
}

# Setup crash trap
trap 'onError' ERR

echo BUILD_SCM_HASH $(git rev-parse HEAD)

BUILD_SCM_VERSION_RAW=$(git describe --match [0-9].[0-9].[0-9]* --abbrev=7 --tags HEAD)

# Reformat `git describe` version string into a more semver-ish string
#   From:   5.2.0-rc.0-57-g757f886
#   To:     5.2.0-rc.0+57.sha-757f886
#   Or:     5.2.0-rc.0+57.sha-757f886.with-local-changes
BUILD_SCM_VERSION="$(echo ${BUILD_SCM_VERSION_RAW} | sed -E 's/-([0-9]+)-g/+\1.sha-/g')"
echo BUILD_SCM_VERSION ${BUILD_SCM_VERSION_OVERRIDE:-$BUILD_SCM_VERSION}