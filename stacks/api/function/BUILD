package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")
load("//tools/dgeni:index.bzl", "docs")

# TODO: Add more build files to make incremental build
ts_library(
    name = "function",
    srcs = glob(["*.ts"]),
    data = glob(["schemas/*.json"]),
    module_name = "@spica-server/function",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/function/engine",
        "//stacks/api/function/engine/language",
        "//stacks/api/function/engine/trigger",
        "//stacks/api/passport",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@nestjs/websockets",
        "@npm//@types/mongodb",
        "@npm//@types/node",
        "@npm//rxjs",
        "@npm//semver",
        "@npm//typescript",
    ],
)

docs(
    name = "docs",
    srcs = [
        "function.controller.ts",
        "subscription.controller.ts",
    ],
    tags = ["function-docs"],
    exports = [
        "FunctionController",
        "SubscriptionController",
    ],
    deps = [
        "//packages/database",
    ],
)
