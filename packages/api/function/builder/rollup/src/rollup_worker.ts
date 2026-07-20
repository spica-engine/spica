import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import fs from "fs";
import {isBuiltin} from "module";
import path from "path";
import {rollup, RollupLog, RollupOptions} from "rollup";
import {parentPort} from "worker_threads";
import {BuildDiagnostic, BuildMeta} from "@spica-server/interface-function-builder";

/*
  Packages that must stay outside the bundle: they either ship native addons or resolve
  their internals through dynamic require, neither of which survives inlining. The runtime
  resolves them through the `.build/node_modules` symlink, exactly as before bundling.
  `@spica-devkit/database` additionally relies on module side effects that the worker
  bootstrap swaps out at runtime (see runtime/node/bootstrap/entrypoint.ts).
*/
const NEVER_BUNDLE = ["mongodb", "@grpc/grpc-js", "@spica-devkit/database"];

const ERROR = 1;

function isExternal(id: string) {
  return isBuiltin(id) || NEVER_BUNDLE.some(pkg => id == pkg || id.startsWith(`${pkg}/`));
}

function toDiagnostic(log: RollupLog, category: number): BuildDiagnostic {
  const line = log.loc?.line ?? 1;
  const column = log.loc?.column ?? 1;
  return {
    code: (log.pluginCode as string) || log.code || "BUNDLE_ERROR",
    category,
    text: log.message,
    start: {line, column},
    end: {line, column}
  };
}

function writeTsconfig(meta: BuildMeta) {
  const tsconfigPath = path.join(meta.cwd, "tsconfig.json");
  fs.writeFileSync(
    tsconfigPath,
    JSON.stringify(
      {
        compilerOptions: {
          moduleResolution: "Node10",
          module: "ES2022",
          target: "ES2022",
          typeRoots: ["./node_modules/@types"],
          sourceMap: true,
          alwaysStrict: true,
          baseUrl: ".",
          rootDir: "."
        },
        include: [meta.entrypoints.build]
      },
      null,
      2
    )
  );
  return tsconfigPath;
}

function createOptions(language: string, meta: BuildMeta, diagnostics: BuildDiagnostic[]) {
  const plugins: RollupOptions["plugins"] = [
    nodeResolve({
      preferBuiltins: true,
      rootDir: meta.cwd,
      exportConditions: ["node", "import", "require", "default"],
      extensions: [".mjs", ".js", ".json", ".ts"]
    }),
    json()
  ];

  if (language == "typescript") {
    plugins.push(
      typescript({
        tsconfig: writeTsconfig(meta),
        filterRoot: meta.cwd
      })
    );
  }

  plugins.push(commonjs({transformMixedEsModules: true, ignore: NEVER_BUNDLE}));

  return {
    input: path.join(meta.cwd, meta.entrypoints.build),
    external: isExternal,
    plugins,
    onwarn: (warning: RollupLog) => {
      // Typescript reports its diagnostics as plugin warnings, but a type error has always
      // failed the build (it is what the api answers 422 with), so they are collected as
      // errors. Everything else rollup warns about (an import left external, a circular
      // dependency) is not fatal and is dropped.
      if (typeof warning.pluginCode == "string" && warning.pluginCode.startsWith("TS")) {
        diagnostics.push(toDiagnostic(warning, ERROR));
      }
    }
  };
}

async function build(language: string, requested: BuildMeta): Promise<BuildDiagnostic[]> {
  const diagnostics: BuildDiagnostic[] = [];

  try {
    // Rollup reports module ids by their real path. Working from the real path too keeps the
    // typescript plugin's file lookups matching those ids when the function root is reached
    // through a symlink (a shared assets mount, /var on macOS).
    const meta: BuildMeta = {...requested, cwd: fs.realpathSync(requested.cwd)};
    const bundle = await rollup(createOptions(language, meta, diagnostics));

    if (diagnostics.length) {
      await bundle.close();
      return diagnostics;
    }

    await bundle.write({
      file: path.join(meta.cwd, meta.outDir, meta.entrypoints.runtime),
      format: "esm",
      sourcemap: true,
      inlineDynamicImports: true
    });
    await bundle.close();
    return [];
  } catch (e) {
    return [...diagnostics, toDiagnostic(e as RollupLog, ERROR)];
  }
}

function handleMessage(message: any) {
  if (message == "quit") {
    cleanUp();
    process.exit(0);
    return;
  }

  const {id, language, meta} = message;
  build(language, meta).then(diagnostics => parentPort.postMessage({id, diagnostics}));
}

function cleanUp() {
  parentPort.off("message", handleMessage);
}

function main() {
  parentPort.on("message", handleMessage);
}

main();
