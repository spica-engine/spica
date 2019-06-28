package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")

ts_library(
    name = "architect",
    srcs = ["architect.ts"],
    deps = [
        "@npm//@angular-devkit/architect",
        "@npm//@angular-devkit/core",
        "@npm//@types/node",
        "@npm//rxjs",
        "@npm//url",
    ],
)

ts_library(
    name = "schematic",
    srcs = ["schematic.ts"],
    deps = [
        "//stacks/api/composer/worker/internal-schematic",
        "@npm//@angular-devkit/core",
        "@npm//@angular-devkit/schematics",
        "@npm//@types/node",
        "@npm//rxjs",
    ],
)
