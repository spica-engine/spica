package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "storage",
    srcs = glob([
        "src/**/*.ts",
        "index.ts",
    ]),
    data = glob(["src/schema/*.json"]),
    module_name = "@spica-server/storage",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/activity/services",
        "//stacks/api/passport",
        "@npm//@google-cloud/storage",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/body-parser",
        "@npm//@types/bson",
        "@npm//@types/mongodb",
        "@npm//@types/node",
        "@npm//body-parser",
        "@npm//bson",
        "@npm//etag",
        "@npm//rxjs",
    ],
)

docs(
    name = "docs",
    srcs = [
        "src/storage.controller.ts",
    ],
    doc_name = "storage",
    tags = ["storage-docs"],
    exports = [
        "StorageController",
    ],
    deps = [
        "//packages/database",
    ],
)
