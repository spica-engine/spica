package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")

ts_library(
    name = "core",
    srcs = [
        "index.ts",
        "middlewares.ts",
        "pipes.ts",
    ],
    module_name = "@spica-server/core",
    tsconfig = "//:tsconfig.json",
    deps = [
        "@npm//@nestjs/common",
        "@npm//@types/body-parser",
        "@npm//@types/bson",
        "@npm//@types/node",
        "@npm//body-parser",
        "@npm//bson",
    ],
)
