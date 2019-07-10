"""
  Implementation of the "docs" rule. The implementation runs Dgeni with the
  specified entry points and outputs the API docs into a package relative directory.
"""
load("@build_bazel_rules_nodejs//internal/common:node_module_info.bzl", "NodeModuleSources", "collect_node_modules_aspect")
load("@npm_bazel_typescript//internal:common/compilation.bzl", "DEPS_ASPECTS")

DocSources = provider(
    doc = "Provides sources for docs",
    fields = {
        "docs": "Output of docs",
        "name": "Name of the doc",
        "list": "Json formatted doc list"
    },
)

def _docs(ctx):
    doc_name = ctx.attr.name
    doc_label_directory = ctx.label.package
    doc_output_directory = "%s/%s/%s" % (ctx.bin_dir.path, doc_label_directory, doc_name)

    doc_list =  ctx.actions.declare_file("%s/%s" % (doc_name, 'doc-list.json'))
    expected_docs = []
    files = []

    for file in ctx.files.srcs:
        basename = file.short_path.replace(doc_label_directory + "/", "")
        expected_docs += [
            ctx.actions.declare_file("%s/%s.html" % (doc_name, basename[:-3])),
        ]
        files += [basename]

    args = ctx.actions.args()
    args.use_param_file("%s", use_always = True)
    args.add(doc_label_directory)
    args.add(doc_output_directory)
    args.add_joined(files, join_with = ",")

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
        outputs = expected_docs + [doc_list],
        arguments = [args],
        progress_message = "Docs %s (%s)" % (doc_label_directory, ctx.attr.module_name),
    )

    generated_docs = depset(expected_docs)

    return [DefaultInfo(files = generated_docs), DocSources( docs = generated_docs, name = ctx.attr.module_name, list = doc_list )]

"""
  Rule definition for the "docs" rule that can generate API documentation
  for specified packages and their entry points.
"""
docs = rule(
    implementation = _docs,
    attrs = {
        "module_name": attr.string(
            mandatory = True,
            doc = ""
        ),
        "srcs": attr.label_list(
            doc = "The TypeScript and Markdown files to compile.",
            allow_files = [".ts", ".md"],
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



def _bundle_docs(ctx):
    bundle_name = ctx.attr.name
    bundle_label_directory = ctx.label.package
    bundle_output_directory = "%s/%s/%s" % (ctx.bin_dir.path, bundle_label_directory, bundle_name)

    docs = []

    inputs = depset()

    doc_list = ctx.actions.declare_file("%s/%s" % (bundle_name, 'doc-list.json'))

    expected_docs = [doc_list]

    for doc in ctx.attr.docs:
        if DocSources in doc:
            _doc = doc[DocSources]
            _path = "%s/%s" % (doc.label.package, doc.label.name)
            _docs = []
            inputs = depset([_doc.list],transitive = [inputs, _doc.docs])
            expected_docs.append(ctx.actions.declare_file("%s/%s/%s" % (bundle_name, _doc.name, _doc.list.short_path.replace(_path, ''))))
            for _d in _doc.docs.to_list(): 
                _docs.append(_d.short_path)
                expected_docs.append(ctx.actions.declare_file("%s/%s/%s" % (bundle_name, _doc.name, _d.short_path.replace(_path, ''))))
            docs.append(struct( title = ctx.attr.docs[doc], name = _doc.name, docs = _docs, list = _doc.list.short_path, path = _path, output = "%s/%s" % (bundle_output_directory, _doc.name) ))
    

    args = ctx.actions.args()
    args.use_param_file("%s", use_always = True)
    args.set_param_file_format(format = "multiline")
    args.add(ctx.bin_dir.path)
    args.add(bundle_output_directory)
    args.add(doc_list.path)
    args.add(struct(docs = docs).to_json())


    ctx.actions.run(
        inputs = inputs,
        executable = ctx.executable._bundler,
        outputs = expected_docs,
        arguments = [args],
        progress_message = "Bundle Docs %s" % (bundle_name),
    )

    return [DefaultInfo(files = depset(expected_docs))]

"""
  Rule definition for the "bundle_docs" rule that can generate bundled docs
"""
bundle_docs = rule(
    implementation = _bundle_docs,
    attrs = {
        "docs": attr.label_keyed_string_dict(
            mandatory = True,
            doc = "Key-value of doc targets. Usually other docs target",
        ),
        "_bundler": attr.label(
            default = Label("//tools/dgeni:bundle"),
            executable = True,
            cfg = "host",
        ),
    }
)

