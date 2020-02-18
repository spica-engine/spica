def _pkg_stamp(ctx):
    package_dir = ctx.actions.declare_directory(ctx.label.name)

    args = ctx.actions.args()
    args.use_param_file("%s", use_always = True)

    args.add(package_dir.path)
    args.add_joined([f.path for f in ctx.files.srcs], join_with = ",", omit_if_empty = False)
    args.add(ctx.attr.substitutions)
    args.add(ctx.version_file.path)

    ctx.actions.run(
        inputs = ctx.files.srcs + [ctx.version_file],
        outputs = [package_dir],
        executable = ctx.executable._packager,
        arguments = [args],
        execution_requirements = {"local": "1"},
    )

    return [DefaultInfo(
        files = depset([package_dir]),
    )]

pkg_stamp = rule(
    implementation = _pkg_stamp,
    attrs = {
        "srcs": attr.label_list(
            doc = """Transitive dependencies that will stamped upon build.""",
            allow_files = False,
        ),
        "substitutions": attr.string_dict(
            doc = """Key-value pairs which are replaced in all the files while building the package.""",
            mandatory = True,
        ),
        "_packager": attr.label(
            default = Label("//tools/pkg_stamp:bundler"),
            cfg = "host",
            executable = True,
        ),
    },
    doc = """The stamp rule creates a directory containing a stamped artifacts.""",
)
