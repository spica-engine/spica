#!/bin/bash
set -e
source "./prepare.sh"

export RUNTIME="node"
export ENTRYPOINT="index"

node --experimental-modules --enable-source-maps --unhandled-rejections=strict --es-module-specifier-resolution=node ./bootstrap/bootstrap.js