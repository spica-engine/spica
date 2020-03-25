package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "controller_testlib",
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
    name = "controller_acceptance",
    deps = [
        ":controller_testlib",
    ],
)

ts_library(
    name = "interceptor_unit_testlib",
    testonly = True,
    srcs = ["activity.interceptor.spec.ts"],
    deps = [
        "//stacks/api/activity",
        "@npm//@types/jasmine",
    ],
)

jasmine_node_test(
    name = "interceptor_unit",
    deps = [
        ":interceptor_unit_testlib",
    ],
)

ts_library(
    name = "interceptor_integration_testlib",
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
    name = "interceptor_integration",
    deps = [
        ":interceptor_integration_testlib",
    ],
)
