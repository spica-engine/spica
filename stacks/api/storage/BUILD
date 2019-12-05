package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "storage",
    srcs = glob(["*.ts"]),
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
        "storage.service.spec.ts",
        "storage.controller.spec.ts",
        "storage.acceptance.spec.ts"
    ],
    deps = [
        ":storage",
         "//packages/core",
        "//packages/database/testing",
        "//stacks/api/passport/testing",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
        "@npm//@types/node",
        "@npm//@nestjs/common",
        "//packages/core/testing",
        "@npm//bson",
        "@npm//@types/bson",

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
