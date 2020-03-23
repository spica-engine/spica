package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "activity_controller_testlib",
    testonly = True,
    srcs = ["activity.controller.spec.ts"],
    deps = [
        "//packages/core/testing",
        "//packages/database/testing",
        "//stacks/api/activity",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
    ],
)

jasmine_node_test(
    name = "activity_controller_test",
    deps = [
        ":activity_controller_testlib",
    ],
)
