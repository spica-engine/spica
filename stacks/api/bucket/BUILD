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
        "@npm//@types/json-schema",
        "@npm//@types/mongodb",
        "@npm//@types/node",
        "@npm//archiver",
        "@npm//cron",
        "@npm//locale",
    ],
)

ts_library(
    name = "bucket-data_test_lib",
    testonly = True,
    srcs = [
        "bucket-data.service.spec.ts",
    ],
    deps = [
        ":bucket",
        "//packages/core",
        "//packages/core/schema",
        "//packages/core/testing",
        "//packages/database",
        "//packages/database/testing",
        "//stacks/api/passport/testing",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/bson",
        "@npm//@types/jasmine",
        "@npm//@types/node",
        "@npm//bson",
    ],
)

jasmine_node_test(
    name = "bucket-data-test",
    deps = [
        ":bucket-data_test_lib",
    ],
)

ts_library(
    name = "bucket-data-acceptance_test_lib",
    testonly = True,
    srcs = [
        "bucket-data.acceptance.spec.ts",
    ],
    deps = [
        ":bucket",
        "//packages/core",
        "//packages/core/schema",
        "//packages/core/testing",
        "//packages/database",
        "//packages/database/testing",
        "//stacks/api/passport/testing",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/bson",
        "@npm//@types/jasmine",
        "@npm//@types/node",
        "@npm//bson",
    ],
)

jasmine_node_test(
    name = "bucket-data-acceptance-test",
    deps = [
        ":bucket-data-acceptance_test_lib",
    ],
)

ts_library(
    name = "bucket_test_lib",
    testonly = True,
    srcs = [
        "bucket.service.spec.ts",
    ],
    deps = [
        ":bucket",
        "//packages/core",
        "//packages/core/schema",
        "//packages/core/testing",
        "//packages/database/testing",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/bson",
        "@npm//@types/jasmine",
        "@npm//@types/node",
        "@npm//bson",
    ],
)

jasmine_node_test(
    name = "bucket-test",
    deps = [
        ":bucket_test_lib",
    ],
)

ts_library(
    name = "scheduler_test_lib",
    testonly = True,
    srcs = [
        "scheduler.spec.ts",
    ],
    deps = [
        ":bucket",
        "//packages/database/testing",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
        "@npm//@types/node",
    ],
)

jasmine_node_test(
    name = "scheduler-test",
    deps = [
        ":scheduler_test_lib",
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
