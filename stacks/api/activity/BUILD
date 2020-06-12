package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")

ts_library(
    name = "activity",
    srcs = glob([
        "src/*.ts",
        "index.ts",
    ]),
    module_name = "@spica-server/activity",
    deps = [
        "//packages/core",
        "//packages/database",
        "//stacks/api/activity/services",
        "//stacks/api/passport",
        "@npm//@nestjs/common",
    ],
)
