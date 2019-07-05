"""
  Implementation of the "_dgeni_api_docs" rule. The implementation runs Dgeni with the
  specified entry points and outputs the API docs into a package relative directory.
"""

load("@build_bazel_rules_nodejs//internal/common:node_module_info.bzl", "NodeModuleSources", "collect_node_modules_aspect")
load("@npm_bazel_typescript//internal:common/compilation.bzl", "DEPS_ASPECTS")

def _dgeni_api_docs(ctx):
    doc_name = ctx.attr.name
    doc_label_directory = ctx.label.package
    doc_output_directory = "%s/%s/%s" % (ctx.bin_dir.path, ctx.label.package, doc_name)

    expected_docs = []
    files = []

    for srcfile in ctx.files.srcs:
        basename = srcfile.short_path.replace(ctx.label.package + "/", "")
        expected_docs += [
            ctx.actions.declare_file("%s/%s.html" % (doc_name, basename[:-3])),
        ]
        files += [basename]

    args = ctx.actions.args()

    args.use_param_file(param_file_arg = "--param-file=%s")

    args.add(doc_label_directory)

    args.add(doc_output_directory)

    args.add_joined(files, join_with = ",")

    # print("Doc name %s" % (doc_name))
    # print("Doc label directory %s" % (doc_label_directory))
    # print("Doc output directory %s" % (doc_output_directory))

    sources = depset(ctx.files.node_modules)

    mappings = dict()

    for d in ctx.attr.deps:
        if hasattr(d, "es6_module_mappings"):
            mappings.update(d.es6_module_mappings)
        if hasattr(d, "node_sources"):
            sources = depset(transitive = [sources, d.node_sources])
        if hasattr(d, "files"):
            sources = depset(transitive = [sources, d.files])

    args.add(mappings)
    args.add(ctx.bin_dir.path)

    ctx.actions.run(
        inputs = ctx.files.srcs + ctx.files._dgeni_templates + sources.to_list(),
        tools = sources,
        executable = ctx.executable._dgeni_bin,
        outputs = expected_docs,
        arguments = [args],
        progress_message = "Docs %s (%s)" % (doc_label_directory, ctx.attr.module_name),
    )

    return DefaultInfo(files = depset(expected_docs))

"""
  Rule definition for the "dgeni_api_docs" rule that can generate API documentation
  for specified packages and their entry points.
"""
docs = rule(
    implementation = _dgeni_api_docs,
    attrs = {
        "module_name": attr.string(),
        "srcs": attr.label_list(
            doc = "The TypeScript source files to compile.",
            allow_files = [".ts"],
            mandatory = True,
        ),
        "node_modules": attr.label(
            doc = "The npm packages which should be available to `tsconfig.paths` during execution.",
            default = Label("@npm//:node_modules"),
        ),
        "deps": attr.label_list(
            aspects = DEPS_ASPECTS + [collect_node_modules_aspect],
            doc = "Compile-time dependencies, typically other ts_library targets",
        ),
        "_dgeni_templates": attr.label(
            default = Label("//tools/dgeni/templates"),
        ),
        "_dgeni_bin": attr.label(
            default = Label("//tools/dgeni"),
            executable = True,
            cfg = "host",
        ),
    },
)
