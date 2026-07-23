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
  Packages kept out of the bundle. They still resolve at runtime from the function's own
  node_modules, which node reaches by walking up from the bundle in `.build`.

  `@spica-devkit/database` must be the very module the runtime prepared: it installs a
  SIGTERM handler and the experimental devkit cache preloads it through a swapped
  createRequire (see runtime/node/bootstrap/entrypoint.ts), which a private copy sidesteps.
  `mongodb` and `@grpc/grpc-js` are already loaded by the worker bootstrap, so inlining them
  would give every function a second multi-megabyte copy and its own driver instance.

  Packages with native addons (sharp, bcrypt, canvas) are additionally externalized on the
  fly by detectsNativeAddon: their `.node` binaries cannot be inlined, so bundling them
  aborts the build. They too resolve from node_modules at runtime.
*/
const NEVER_BUNDLE = ["mongodb", "@grpc/grpc-js", "@spica-devkit/database"];

const ERROR = 1;

// Bound the per-package scan so a pathological tree cannot stall a build.
const MAX_SCANNED_DIRS = 5000;

function packageNameOf(id: string): string {
  const segments = id.split("/");
  return id.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
}

// A native addon ships either a compiled `.node` binary (prebuilt-binary packages like
// @img/sharp-*) or a `binding.gyp` it builds from source (canvas, bcrypt). Either marker
// anywhere in the package directory means rollup cannot inline it.
function containsNativeAddon(dir: string): boolean {
  const stack = [dir];
  let scanned = 0;
  while (stack.length) {
    const current = stack.pop();
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, {withFileTypes: true});
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith(".node") || entry.name == "binding.gyp")) {
        return true;
      }
      // Skip nested node_modules: a dependency's binary does not force its dependent external,
      // and descending into them is what would blow past the scan bound.
      if (entry.isDirectory() && entry.name != "node_modules" && ++scanned < MAX_SCANNED_DIRS) {
        stack.push(path.join(current, entry.name));
      }
    }
  }
  return false;
}

function createExternalPredicate(cwd: string): (id: string) => boolean {
  const nativeByPackage = new Map<string, boolean>();

  return (id: string) => {
    if (isBuiltin(id)) {
      return true;
    }
    if (NEVER_BUNDLE.some(pkg => id == pkg || id.startsWith(`${pkg}/`))) {
      return true;
    }
    // Relative and absolute ids are the user's own files — always bundled.
    if (id.startsWith(".") || path.isAbsolute(id)) {
      return false;
    }

    const name = packageNameOf(id);
    if (!nativeByPackage.has(name)) {
      nativeByPackage.set(name, containsNativeAddon(path.join(cwd, "node_modules", name)));
    }
    return nativeByPackage.get(name);
  };
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
  /*
    Resolvers tried in order, instead of one with every condition active, so a package's esm
    build wins over its commonjs one — commonjs goes through plugin-commonjs as an opaque
    namespace and barely tree-shakes (date-fns costs 689KB that way and 89KB as esm).

    The first pass deliberately omits "node": a condition matches by the *package's* key order,
    and packages like rxjs list "node" -> ./dist/cjs before their esm entry, so keeping "node"
    active pulls in the commonjs build and every unused operator with it. Without it rxjs
    resolves to ./dist/esm and drops from 314KB to tree-shaken.

    The short condition list is an optimisation, not a correctness mechanism: "default" always
    matches regardless of what is listed here, so a package using some alias we do not name
    still resolves through it (typically to the same esm build, occasionally an older target).
    Missing an alias costs bundle size, never correctness — which is why this list stays small.
  */
  const resolvers = [
    ["import", "module", "es2015"],
    ["node", "import", "default"],
    ["node", "require", "default"]
  ].map(exportConditions =>
    nodeResolve({
      preferBuiltins: true,
      rootDir: meta.cwd,
      exportConditions,
      extensions: [".mjs", ".js", ".json", ".ts"]
    })
  );

  const plugins: RollupOptions["plugins"] = [...resolvers, json()];

  if (language == "typescript") {
    plugins.push(
      typescript({
        tsconfig: writeTsconfig(meta),
        filterRoot: meta.cwd
      })
    );
  }

  // The same predicate gates ESM imports (rollup's `external`) and CJS require() calls
  // (commonjs `ignore`), so a native addon or never-bundle package reached through either
  // syntax is left out of the bundle consistently.
  const isExternal = createExternalPredicate(meta.cwd);
  plugins.push(commonjs({transformMixedEsModules: true, ignore: isExternal}));

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

    // close() must run even if write() throws (disk full, bad path); otherwise the bundle's
    // caches and handles leak in this long-lived worker thread.
    try {
      if (diagnostics.length) {
        return diagnostics;
      }

      await bundle.write({
        file: path.join(meta.cwd, meta.outDir, meta.entrypoints.runtime),
        format: "esm",
        sourcemap: true,
        inlineDynamicImports: true
      });
      return [];
    } finally {
      await bundle.close();
    }
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
