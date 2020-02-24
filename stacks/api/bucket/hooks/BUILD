package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "hooks",
    srcs = [
        "src/hook.module.ts",
        "src/scheduler.ts",
        "src/index.ts",
        "index.ts"
    ],
    module_name = "@spica-server/bucket/hooks",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/bucket/services",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@types/json-schema",
        "@npm//@types/node",
        "@npm//rxjs",
        "//stacks/api/function/queue",
        "//stacks/api/function/queue/proto",
        "//stacks/api/function/enqueuer"
    ],
)
