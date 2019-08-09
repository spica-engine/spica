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
