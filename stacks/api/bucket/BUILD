package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "bucket",
    srcs = glob(["**/*.ts"]),
    data = glob(["**/*.json"]),
    module_name = "@spica-server/bucket",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/passport",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/archiver",
        "@npm//@types/deep-diff",
        "@npm//@types/diff-match-patch",
        "@npm//@types/json-schema",
        "@npm//@types/mongodb",
        "@npm//@types/node",
        "@npm//ajv",
        "@npm//archiver",
        "@npm//deep-diff",
        "@npm//diff-match-patch",
        "@npm//locale",
    ],
)

docs(
    name = "docs",
    srcs = [
        "bucket.controller.ts",
        "bucket.ts",
        "bucket-data.controller.ts",
        "history/history.controller.ts",
    ],
    module_name = "@spica-server/bucket",
    tags = ["bucket-docs"],
    deps = [
        "//packages/database",
        "//stacks/api/passport",
        "//stacks/api/preference",
    ],
)
