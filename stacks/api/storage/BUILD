package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")

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
