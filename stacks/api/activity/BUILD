package(default_visibility = ["//visibility:public"])

load("@npm_bazel_typescript//:index.bzl", "ts_library")
# load("@npm_bazel_jasmine//:index.bzl", "jasmine_node_test")


ts_library(
    name = "activity",
    srcs = glob(
        include = ["**/*.ts"],
        exclude = ["**/*.spec.ts"],
    ),
    module_name = "@spica-server/activity",
    deps = [
        "//packages/database",
        "@npm//@nestjs/common",
        "@npm//rxjs",
    ],
)

# ts_library(
#     name = "activity_logger_testlib",
#     testonly = True,
#     srcs = ["activity.logger.spec.ts"],
#     deps = [
#         "@npm//@types/jasmine",
#         ":activity"
#     ],
# )

# jasmine_node_test(
#     name = "activity_logger_test",
#     deps = [
#         ":activity_logger_testlib",
#     ],
# )