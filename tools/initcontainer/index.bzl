load("@build_bazel_rules_nodejs//:providers.bzl", "JSNamedModuleInfo")

# Workaround for https://github.com/bazelbuild/rules_typescript/issues/263
def _pickup_es5_sources(ctx):
    sources = depset()
    for src in ctx.attr.srcs:
        if JSNamedModuleInfo in src:
            sources = depset(transitive = [sources, src[JSNamedModuleInfo].sources])

    return DefaultInfo(files = sources)

pickup_es5_sources = rule(
    implementation = _pickup_es5_sources,
    attrs = {
        "srcs": attr.label_list(
            doc = "Compile-time dependencies, typically other ts_library targets",
        ),
    },
)
