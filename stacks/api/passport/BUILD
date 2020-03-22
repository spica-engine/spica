package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")
load("//tools/dgeni:index.bzl", "docs")

ts_library(
    name = "passport",
    srcs = glob(
        include = ["**/*.ts"],
        exclude = ["**/*.spec.ts"],
    ),
    data = glob(["**/*.json"]),
    module_name = "@spica-server/passport",
    deps = [
        "//packages/core",
        "//packages/core/schema",
        "//packages/database",
        "//stacks/api/activity",
        "//stacks/api/preference/service",
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
        "@npm//uniqid",
    ],
)

ts_library(
    name = "passport_test_lib",
    testonly = True,
    srcs = glob(["**/*.spec.ts"]),
    deps = [
        ":passport",
        "//packages/core/testing",
        "//packages/database/testing",
        "//stacks/api/passport/testing",
        "//stacks/api/preference/testing",
        "@npm//@nestjs/common",
        "@npm//@nestjs/testing",
        "@npm//@types/jasmine",
    ],
)

jasmine_node_test(
    name = "passport_test",
    deps = [
        ":passport_test_lib",
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
