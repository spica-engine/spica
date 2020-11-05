#!/bin/bash

set -e

export RUNTIME="node"
export ENTRYPOINT="index"

export PATH=$(env -i bash -l -c 'echo $PATH')

PLATFORM=$(uname -s)

case $PLATFORM in
    "Linux")
        PLATFORM_ARCH="linux-x64"
        ;;
    "Darwin")
        PLATFORM_ARCH="darwin-x64"
        ;;
esac

NAME="node-v$VERSION-$PLATFORM_ARCH"
URL="https://nodejs.org/dist/v$VERSION/$NAME.tar.gz"

mkdir -p "./versions"

BIN="./versions/$NAME/bin/node"

if [ ! -f $BIN ]; then
    curl -s "$URL" | tar xvf - -C "./versions"
fi

$BIN --experimental-modules --enable-source-maps --unhandled-rejections=strict --es-module-specifier-resolution=node ./bootstrap/bootstrap.js