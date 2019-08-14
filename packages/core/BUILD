package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "core",
    srcs = [
        "index.ts",
        "middlewares.ts",
        "pipes.ts",
    ],
    module_name = "@spica-server/core",
    tsconfig = "//:tsconfig.json",
    deps = [
        "@npm//@nestjs/common",
        "@npm//@types/body-parser",
        "@npm//@types/bson",
        "@npm//@types/node",
        "@npm//body-parser",
        "@npm//bson",
    ],
)

ts_library(
    name = "test_lib",
    testonly = True,
    srcs = [
        "pipes.spec.ts",
    ],
    tsconfig = "//:tsconfig.json",
    deps = [
        ":core",
        "@npm//@types/jasmine",
        "@npm//@types/json-schema",
        "@npm//@types/node",
    ],
)

jasmine_node_test(
    name = "test",
    srcs = [":test_lib"],
)
