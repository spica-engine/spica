package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "function",
    srcs = glob([
        "src/**/*.ts",
        "index.ts",
    ]),
    data = glob(["src/schema/*.json"]),
    module_name = "@spica-server/function",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/activity/services",
        "//stacks/api/function/enqueuer",
        "//stacks/api/function/scheduler",
        "//stacks/api/function/pkgmanager",
        "//stacks/api/function/queue/proto",
        "//stacks/api/function/webhook",
        "//stacks/api/passport",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@nestjs/websockets",
        "@npm//@types/json-schema",
        "@npm//@types/mongodb",
        "@npm//@types/node",
        "@npm//rimraf",
        "@npm//rxjs",
        "@npm//typescript",
    ],
)

docs(
    name = "docs",
    srcs = [
        "src/function.controller.ts",
        #"src/subscription.controller.ts",
    ],
    tags = ["function-docs"],
    exports = [
        "FunctionController",
        #"SubscriptionController",
    ],
    deps = [
        "//packages/database",
    ],
)
