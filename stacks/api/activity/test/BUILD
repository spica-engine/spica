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
    name = "activity_controller_acceptance",
    deps = [
        ":activity_controller_testlib",
    ],
)

ts_library(
    name = "activity_interceptor_unit_testlib",
    testonly = True,
    srcs = ["activity.interceptor.spec.ts"],
    deps = [
        "//stacks/api/activity",
        "@npm//@types/jasmine",
    ],
)

jasmine_node_test(
    name = "activity_interceptor_unit",
    deps = [
        ":activity_interceptor_unit_testlib",
    ],
)

ts_library(
    name = "activity_interceptor_integration_testlib",
    testonly = True,
    srcs = ["activity.interceptor.integration.spec.ts"],
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
    name = "activity_interceptor_integration",
    deps = [
        ":activity_interceptor_integration_testlib",
    ],
)
