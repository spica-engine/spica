package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "preference",
    srcs = glob([
        "src/*.ts",
        "index.ts",
    ]),
    module_name = "@spica-server/preference",
    deps = [
        "//packages/database",
        "//stacks/api/activity/services",
        "//stacks/api/passport",
        "//stacks/api/preference/services",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@types/mongodb",
        "@npm//rxjs",
    ],
)
