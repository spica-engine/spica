package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")
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
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/mongodb",
        "@npm//rxjs",
    ],
)

ts_library(
    name = "test_lib_preference-service",
    testonly = True,
    srcs = [
        "preference.service.spec.ts",
    ],
    deps = [
        ":preference",
        "//packages/core",
        "//packages/core/testing",
        "//packages/database/testing",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
        "@npm//@types/node",
        "@npm//rxjs",
    ],
)

jasmine_node_test(
    name = "test-preference-service",
    deps = [
        ":test_lib_preference-service",
    ],
)

ts_library(
    name = "test_lib_preference-acceptance",
    testonly = True,
    srcs = [
        "preference.acceptance.spec.ts"
    ],
    deps = [
        ":preference",
        "//packages/core",
        "//packages/core/testing",
        "//packages/database/testing",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
        "@npm//@types/node",
        "@npm//rxjs",
    ],
)

jasmine_node_test(
    name = "test-preference-acceptance",
    deps = [
        ":test_lib_preference-acceptance",
    ],
)


