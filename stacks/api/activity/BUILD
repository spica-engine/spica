package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")

ts_library(
    name = "activity",
    srcs = glob(
        include = ["**/*.ts"],
        exclude = ["**/*.spec.ts"],
    ),
    module_name = "@spica-server/activity",
    deps = [
        "//packages/database",
        "//packages/core",
        "@npm//@nestjs/common",
        "@npm//rxjs",
        "@npm//@types/mongodb",
    ],
)
