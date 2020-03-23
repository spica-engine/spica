#!/usr/bin/env bash

yarn bazel build //stacks/cli:package

(cd ./bazel-bin/stacks/cli/package && yarn unlink  && yarn link)

yarn link @spica/cli