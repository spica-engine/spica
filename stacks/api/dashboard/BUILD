package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
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
    name = "service_test_lib",
    testonly = True,
    srcs = [
        "dashboard.service.spec.ts",
    ],
    deps = [
        "//stacks/api/dashboard",
        "@npm//@nestjs/common",
        "@npm//@types/jasmine",
    ],
)

jasmine_node_test(
    name = "service_test",
    deps = [
        ":service_test_lib",
    ],
)

ts_library(
    name = "controller_test_lib",
    testonly = True,
    srcs = [
        "dashboard.controller.spec.ts",
    ],
    deps = [
        "//packages/core/testing",
        "//stacks/api/passport/testing",
        "//stacks/api/dashboard",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
    ],
)

jasmine_node_test(
    name = "controller_test",
    deps = [
        ":controller_test_lib",
    ],
)
