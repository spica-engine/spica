package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")

ts_library(
    name = "activity_test_lib",
    testonly = True,
    srcs = [
        "activity.resource.spec.ts",
    ],
    deps = [
        "//stacks/api/activity/services",
        "//stacks/api/function",
        "@npm//@types/jasmine",
    ],
)

jasmine_node_test(
    name = "activity_test",
    deps = [
        "activity_test_lib",
    ],
)
