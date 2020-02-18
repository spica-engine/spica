// Temporary wrapper script which makes sure that the proper, locally-installed, binary is used when
// running ibazel. Currently ibazel only looks for bazel in the PATH or @bazel/bazel, but not in
// @bazel/bazelisk. See: https://github.com/bazelbuild/bazel-watcher/issues/339
const shelljs = require('shelljs');
const path = require('path');
const localIbazelBinary = path.resolve('./node_modules/.bin/ibazel');
const localBazelBinary = require('@bazel/bazelisk/bazelisk.js').getNativeBinary();
const args = process.argv.slice(2).join(' ');

shelljs.exec(`${localIbazelBinary} -bazel_path ${localBazelBinary} ${args}`);