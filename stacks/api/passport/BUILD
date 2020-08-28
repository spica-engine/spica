package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "passport",
    srcs = glob([
        "index.ts",
        "src/**/*.ts"
    ]),
    module_name = "@spica-server/passport",
    deps = [
        "@npm//@nestjs/common",
        "@npm//rxjs",
        "@npm//saml2-js",
        "@npm//uuid",
        "@npm//node-forge",
        "@npm//@types/node-forge",
        "@npm//@nestjs/passport",
        "//packages/database",
        "//stacks/api/preference/services",
        "//stacks/api/passport/identity",
        "//stacks/api/passport/policy",
        "//stacks/api/passport/guard"
    ],
)

docs(
    name = "docs",
    srcs = [
        "passport.controller.ts",
    ],
    doc_name = "passport",
    tags = ["passport-docs"],
    exports = [
        "passport",
    ],
    deps = [
        "//packages/database",
    ],
)
