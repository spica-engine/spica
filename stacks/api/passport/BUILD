package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:defs.bzl", "ts_library")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "passport",
    srcs = glob(["**/*.ts"]),
    data = glob(["**/*.json"]),
    module_name = "@spica-server/passport",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/preference",
        "@npm//@nestjs/common",
        "@npm//@nestjs/core",
        "@npm//@nestjs/jwt",
        "@npm//@nestjs/passport",
        "@npm//@types/matcher",
        "@npm//@types/mongodb",
        "@npm//@types/node",
        "@npm//@types/saml2-js",
        "@npm//bcryptjs",
        "@npm//matcher",
        "@npm//passport-jwt",
        "@npm//passport-saml",
        "@npm//path-to-regexp",
        "@npm//pem",
        "@npm//rxjs",
        "@npm//saml2-js",
    ],
)

docs(
    name = "docs",
    srcs = [
        "identity/identity.controller.ts",
        "passport.controller.ts",
        "policy/policy.controller.ts",
    ],
    tags = ["passport-docs"],
    exports = [
        "IdentityController",
        "PassportController",
        "PolicyController",
    ],
    deps = [
        "//packages/database",
    ],
)
