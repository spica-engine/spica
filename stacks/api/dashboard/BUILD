package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")

ts_library(
    name = "dashboard",
    srcs = glob(["*.ts"]),
    module_name = "@spica-server/dashboard",
       deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/passport",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/archiver",
        "@npm//@types/json-schema",
        "@npm//@types/mongodb",
        "@npm//@types/node",
        "@npm//archiver",
        "@npm//cron",
        "@npm//locale",
    ],
)


