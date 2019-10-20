# Workaround for https://github.com/bazelbuild/rules_typescript/issues/263
def _tslibrary_downstream(ctx):
    sources = depset()
    for d in ctx.attr.libraries:
        if hasattr(d, "typescript"):
            sources = depset(transitive = [sources, d.typescript.es5_sources])

    return DefaultInfo(files = sources)

ts_library_d = rule(
    implementation = _tslibrary_downstream,
    attrs = {
        "libraries": attr.label_list(
            doc = "Compile-time dependencies, typically other ts_library targets",
        ),
    },
)
