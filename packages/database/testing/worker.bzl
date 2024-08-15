def _database_worker(ctx):
    output = ctx.actions.declare_file(ctx.attr.type + ".json")

    args = ctx.actions.args()

    args.use_param_file("@%s", use_always = True)
    args.set_param_file_format("multiline")

    args.add(output.path)
    args.add(ctx.attr.type)

    ctx.actions.run(
        arguments = [args],
        executable = ctx.executable.worker,
        outputs = [output],
        execution_requirements = {
            "supports-workers": "1",
            "no-cache": "1",
        },
        mnemonic = "DatabaseCompile",
        env = {
            "COMPILATION_MODE": ctx.var["COMPILATION_MODE"],
            "PATH": ctx.host_configuration.default_shell_env["PATH"],
        },
    )

    return [
        DefaultInfo(
            runfiles = ctx.runfiles([output]),
        ),
    ]

database_worker = rule(
    implementation = _database_worker,
    attrs = {
        "type": attr.string(mandatory = True),
        "worker": attr.label(
            default = Label("//packages/database/testing:worker"),
            executable = True,
            cfg = "host",
        ),
    },
)
