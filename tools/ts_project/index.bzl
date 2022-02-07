load("@npm//@bazel/typescript:index.bzl", _ts_project = "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "js_library")

def ts_project(name, srcs, deps, package_name = None, tsconfig = "//:tsconfig.json", data = [], **kwargs):
    testonly = kwargs.pop("testonly", False)
    if "module_name" in kwargs.keys():
        fail("module_name is not supported, run: yarn buildozer 'rename module_name package_name' %s:%s" % (native.package_name(), name))

    _ts_project(
        name = "compile_%s" % name if package_name else name,
        srcs = srcs,
        deps = deps,
        tsconfig = tsconfig,
        source_map = True,
        declaration = True,
        resolve_json_module = True,
        testonly = testonly,
        data = data,
        **kwargs
    )
    if package_name:
        js_library(
            name = name,
            package_name = package_name,
            testonly = testonly,
            deps = [":compile_%s" % name],
        )
