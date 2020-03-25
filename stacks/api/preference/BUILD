package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "preference",
    srcs = glob(
        include = ["**/*.ts"],
        exclude = ["**/*.spec.ts"],
    ),
    module_name = "@spica-server/preference",
    deps = [
        "//packages/database",
        "//stacks/api/activity",
        "//stacks/api/passport",
        "//stacks/api/preference/service",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/mongodb",
        "@npm//rxjs",
    ],
)

ts_library(
    name = "test_lib_preference-acceptance",
    testonly = True,
    srcs = [
        "preference.acceptance.spec.ts",
    ],
    deps = [
        ":preference",
        "//packages/core",
        "//packages/core/testing",
        "//packages/database/testing",
        "//stacks/api/passport/testing",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
        "@npm//@types/node",
        "@npm//rxjs",
    ],
)

jasmine_node_test(
    name = "test-preference-acceptance",
    tags = [
        "flaky",
    ],
    deps = [
        ":test_lib_preference-acceptance",
    ],
)

ts_library(
    name = "activity_test_lib",
    testonly = True,
    srcs = [
        "activity.resource.spec.ts",
    ],
    deps = [
        "//stacks/api/activity",
        "//stacks/api/preference",
        "@npm//@types/jasmine",
    ],
)

jasmine_node_test(
    name = "activity_test",
    deps = [
        "activity_test_lib",
    ],
)
