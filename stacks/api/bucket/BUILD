package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "bucket",
    srcs = glob(
        include = ["**/*.ts"],
        exclude = ["**/*.spec.ts"],
    ),
    data = glob(["**/*.json"]),
    module_name = "@spica-server/bucket",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/bucket/history",
        "//stacks/api/passport",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/archiver",
        "@npm//@types/deep-diff",
        "@npm//@types/diff-match-patch",
        "@npm//@types/json-schema",
        "@npm//@types/mongodb",
        "@npm//@types/node",
        "@npm//ajv",
        "@npm//archiver",
        "@npm//deep-diff",
        "@npm//diff-match-patch",
        "@npm//locale",
    ],
)

ts_library(
    name = "test_lib",
    testonly = True,
    srcs = glob(["*.spec.ts"]),
    tsconfig = "//:tsconfig.json",
    deps = [
        ":bucket",
        "//packages/core/schema",
        "//packages/database/testing",
        "//stacks/api/preference",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
        "@npm//@types/node",
    ],
)

jasmine_node_test(
    name = "test",
    srcs = [":test_lib"],
    coverage = True,
    deps = [
        "@npm//jasmine",
        "@npm//source-map",
    ],
)

docs(
    name = "docs",
    srcs = glob(["**/*.ts"]),
    tags = ["bucket-docs"],
    exports = [
        "BucketController",
        "BucketDataController",
    ],
    deps = [
        "//packages/database",
        "//stacks/api/passport",
    ],
)
