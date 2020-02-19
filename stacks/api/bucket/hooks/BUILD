package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "hooks",
    srcs = [
        "hook.module.ts",
        "index.ts",
    ],
    module_name = "@spica-server/bucket/hooks",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/bucket/services",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@types/json-schema",
        "@npm//@types/node",
    ],
)

ts_library(
    name = "hook_test_lib",
    testonly = True,
    srcs = ["hook.spec.ts"],
    deps = [
        ":hooks",
        "//packages/core/schema",
        "//packages/database",
        "//packages/database/testing",
        "//stacks/api/bucket/services",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
    ],
)

jasmine_node_test(
    name = "hook_test",
    deps = [
        ":hook_test_lib",
    ],
)
