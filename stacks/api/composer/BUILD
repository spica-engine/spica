package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")

ts_library(
    name = "palette",
    srcs = ["palette.ts"],
    deps = [
        "@npm//@types/css-tree",
        "@npm//@types/node",
        "@npm//color-name-list",
        "@npm//css-tree",
        "@npm//nearest-color",
    ],
)

ts_library(
    name = "composer",
    srcs = glob(
        include = ["**/*.ts"],
        exclude = ["palette.ts"],
    ),
    data = glob(["devkit/rules/files/**/*.template"]),
    module_name = "@spica-server/composer",
    deps = [
        ":palette",
        "//stacks/api/composer/worker:architect",
        "//stacks/api/composer/worker:schematic",
        "@npm//@angular-devkit/core",
        "@npm//@angular-devkit/schematics",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@nestjs/websockets",
        "@npm//@schematics/angular",
        "@npm//@types/css-tree",
        "@npm//@types/json-schema",
        "@npm//@types/node",
        "@npm//css-tree",
        "@npm//fast-glob",
        "@npm//http-proxy-middleware",
        "@npm//multimatch",
        "@npm//pacote",
        "@npm//parse5",
        "@npm//request-promise-native",
        "@npm//rxjs",
        "@npm//typescript",
    ],
)
