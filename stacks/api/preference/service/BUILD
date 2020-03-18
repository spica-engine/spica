package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "service",
    srcs = glob(
        include = ["**/*.ts"],
        exclude = ["**/*.spec.ts"],
    ),
    module_name = "@spica-server/preference/service",
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
        "//stacks/api/preference/service",
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
