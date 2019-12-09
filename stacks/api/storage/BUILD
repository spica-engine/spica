package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "storage",
    srcs = glob(
        include = ["**/*.ts"],
        exclude = ["**/*.spec.ts"],
    ),
    module_name = "@spica-server/storage",
    deps = [
        "//packages/core",
        "//packages/database",
        "//stacks/api/passport",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/bson",
        "@npm//@types/mongodb",
        "@npm//@types/node",
        "@npm//bson",
    ],
)

ts_library(
    name = "test_lib",
    testonly = True,
    srcs = [
        "storage.acceptance.spec.ts",
        "storage.controller.spec.ts",
        "storage.service.spec.ts",
    ],
    deps = [
        ":storage",
        "//packages/core",
        "//packages/core/testing",
        "//packages/database/testing",
        "//stacks/api/passport/testing",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/bson",
        "@npm//@types/jasmine",
        "@npm//@types/node",
        "@npm//bson",
    ],
)

jasmine_node_test(
    name = "test",
    deps = [
        ":test_lib",
    ],
)

docs(
    name = "docs",
    srcs = [
        "storage.controller.ts",
    ],
    tags = ["storage-docs"],
    exports = [
        "StorageController",
    ],
    deps = [
        "//packages/database",
    ],
)
