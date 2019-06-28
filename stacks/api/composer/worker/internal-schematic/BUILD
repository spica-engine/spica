package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")

ts_library(
    name = "internal-schematic",
    srcs = glob(["**/*.ts"]),
    data = glob(["**/files/**/*.template"]) + [
        "package.json",
        "collection.json",
    ],
    deps = [
        "//stacks/api/composer:palette",
        "@npm//@angular-devkit/core",
        "@npm//@angular-devkit/schematics",
        "@npm//@types/node",
    ],
)
