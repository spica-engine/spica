package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")

ts_library(
    name = "hooks",
    srcs = glob([
        "src/*.ts",
    ]) + ["index.ts"],
    module_name = "@spica-server/bucket/hooks",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/bucket/hooks/proto",
        "//stacks/api/bucket/services",
        "//stacks/api/function",
        "//stacks/api/function/enqueuer",
        "//stacks/api/function/scheduler",
        "//stacks/api/function/queue",
        "//stacks/api/function/queue/proto",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@types/json-schema",
        "@npm//@types/node",
        "@npm//grpc",
        "@npm//rxjs",
    ],
)
