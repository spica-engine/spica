package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "function",
    srcs = glob([
        "src/**/*.ts",
        "index.ts",
    ]),
    data = glob(["schemas/*.json"]),
    module_name = "@spica-server/function",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/passport",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@nestjs/websockets",
        "@npm//@types/mongodb",
        "@npm//@types/json-schema",
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
