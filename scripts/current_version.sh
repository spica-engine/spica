#!/usr/bin/env bash
# Used with Bazel's stamping feature
echo BUILD_SCM_VERSION ${BUILD_SCM_VERSION_OVERRIDE:-$(git describe --abbrev=7 --tags HEAD)}
echo BUILD_SCM_HASH $(git rev-parse HEAD)
