import {Compilation} from "@spica-server/interface/function/compiler";
import fs from "fs";
import path from "path";
import ts from "typescript";
import {parentPort} from "worker_threads";

function build(compilation: Compilation) {
  const entryPoint = path.join(compilation.cwd, compilation.entrypoints.build);
  const outDirAbsolutePath = path.join(compilation.cwd, compilation.outDir);

  const tsconfigOptions = {
    moduleResolution: "node",
    module: "ES2022",
    target: "ES2022",
    typeRoots: ["./node_modules/@types"],
    sourceMap: true,
    alwaysStrict: true,
    preserveSymlinks: true,
    incremental: true,
    tsBuildInfoFile: path.join(compilation.outDir, ".tsbuildinfo"),
    baseUrl: ".",
    rootDir: ".",
    outDir: compilation.outDir,
    declaration: true
  };

  const tsconfigPath = path.join(compilation.cwd, "tsconfig.json");
  fs.writeFileSync(
    tsconfigPath,
    JSON.stringify(
      {
        compilerOptions: tsconfigOptions,
        include: [compilation.entrypoints.build]
      },
      null,
      2
    )
  );

  const compilerOptions: ts.CompilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.Node10,
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    typeRoots: [path.join(compilation.cwd, "node_modules/@types")],
    sourceMap: tsconfigOptions.sourceMap,
    alwaysStrict: tsconfigOptions.alwaysStrict,
    preserveSymlinks: tsconfigOptions.preserveSymlinks,
    incremental: tsconfigOptions.incremental,
    tsBuildInfoFile: path.join(compilation.outDir, ".tsbuildinfo"),
    baseUrl: compilation.cwd,
    rootDir: compilation.cwd,
    outDir: outDirAbsolutePath,
    declaration: tsconfigOptions.declaration
  };

  const program = ts.createProgram([entryPoint], compilerOptions);

  const diagnostics = Array.from(ts.getPreEmitDiagnostics(program));

  program.emit();

  postCompilation(compilation.cwd, outDirAbsolutePath, diagnostics);
}

function renameJsToMjs(outDir: string) {
  const jsFile = path.join(outDir, "index.js");
  const mjsFile = path.join(outDir, "index.mjs");
  if (fs.existsSync(jsFile)) {
    fs.renameSync(jsFile, mjsFile);
  }
}
function postCompilation(baseUrl: string, outDir: string, diagnostics: ts.Diagnostic[]) {
  renameJsToMjs(outDir);
  parentPort.postMessage({
    baseUrl: baseUrl,
    diagnostics: diagnostics
      .filter(d => d.file)
      .map((diagnostic: ts.Diagnostic) => {
        const start = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
        const end = ts.getLineAndCharacterOfPosition(
          diagnostic.file,
          diagnostic.start + diagnostic.length
        );
        return {
          code: diagnostic.code,
          category: diagnostic.category,
          text: ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine),
          start: {
            line: start.line + 1,
            column: start.character + 1
          },
          end: {
            line: end.line + 1,
            column: end.character + 1
          }
        };
      })
  });
}
function handleMessage(message: any) {
  if (message == "quit") {
    cleanUp();
    process.exit(0);
  } else {
    build(message);
  }
}

function cleanUp() {
  parentPort.off("message", handleMessage);
}

function main() {
  parentPort.on("message", handleMessage);
}

main();
