import {Compilation} from "@spica-server/interface/function/compiler";
import fs from "fs";
import path from "path";
import ts from "typescript";
import {parentPort} from "worker_threads";

function build(compilation: Compilation) {
  const entryPoint = path.join(compilation.cwd, compilation.entrypoints.build);
  const outDirAbsolutePath = path.join(compilation.cwd, compilation.outDir);
  const outDirRelative = compilation.outDir;
  const currentDirectory = compilation.cwd;

  const compilerOptionsJson = {
    moduleResolution: "Node10",
    module: "ES2022",
    target: "ES2022",
    typeRoots: ["./node_modules/@types"],
    sourceMap: true,
    alwaysStrict: true,
    preserveSymlinks: true,
    incremental: true,
    declaration: true,
    tsBuildInfoFile: path.join(outDirRelative, ".tsbuildinfo"),
    baseUrl: ".",
    rootDir: ".",
    outDir: outDirRelative
  };

  const resolvedJson = {
    ...compilerOptionsJson,
    typeRoots: compilerOptionsJson.typeRoots.map(p => path.resolve(currentDirectory, p)),
    tsBuildInfoFile: path.resolve(currentDirectory, compilerOptionsJson.tsBuildInfoFile),
    baseUrl: path.resolve(currentDirectory, compilerOptionsJson.baseUrl),
    rootDir: path.resolve(currentDirectory, compilerOptionsJson.rootDir),
    outDir: path.resolve(currentDirectory, compilerOptionsJson.outDir)
  };

  const {options: compilerOptions} = ts.convertCompilerOptionsFromJson(
    resolvedJson,
    currentDirectory
  );

  const tsconfigPath = path.join(currentDirectory, "tsconfig.json");

  fs.writeFileSync(
    tsconfigPath,
    JSON.stringify(
      {
        compilerOptions: compilerOptionsJson,
        include: [compilation.entrypoints.build]
      },
      null,
      2
    )
  );
  const program = ts.createProgram([entryPoint], compilerOptions);
  const diagnostics = Array.from(ts.getPreEmitDiagnostics(program));
  program.emit();
  postCompilation(currentDirectory, outDirAbsolutePath, diagnostics);
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
