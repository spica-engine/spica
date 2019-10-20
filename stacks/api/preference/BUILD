package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")

ts_library(
    name = "preference",
    srcs = glob(["*.ts"]),
    module_name = "@spica-server/preference",
    deps = [
        "//packages/database",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/mongodb",
        "@npm//rxjs",
    ],
)
