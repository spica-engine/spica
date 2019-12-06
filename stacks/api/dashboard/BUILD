package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "dashboard",
    srcs = glob(
        include = ["**/*.ts"],
        exclude = ["**/*.spec.ts"],
    ),
    module_name = "@spica-server/dashboard",
    deps = [
        "//packages/core",
        "//stacks/api/passport",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/json-schema",
        "@npm//@types/node",
        "@npm//locale",
    ],
)

ts_library(
    name = "test_lib",
    testonly = True,
    srcs = [
        "dashboard.controller.spec.ts",
        "dashboard.service.spec.ts",
    ],
    deps = [
        ":dashboard",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
        "@npm//@types/node",
    ],
)

jasmine_node_test(
    name = "test",
    deps = [
        ":test_lib",
    ],
)
