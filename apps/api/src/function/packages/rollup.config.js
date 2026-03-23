import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import {dts} from "rollup-plugin-dts";
import fs from "fs";
import path from "path";

export function cleanUp(path) {
  if (fs.existsSync(path)) {
    fs.rmSync(path, {recursive: true, force: true});
  }
}

const sharedExternals = ["mongodb", "axios", "ws", "rxjs", "rxjs/operators", "json-schema"];

export default function getConfig(project, additionalCopyPaths = []) {
  const base = path.join("apps/api/src/function/packages", project);
  const dist = path.join("dist", base);

  cleanUp(dist);

  const copyTargets = [
    {
      src: path.join(base, "package.json"),
      dest: dist
    }
  ];

  if (additionalCopyPaths) {
    additionalCopyPaths.forEach(additionalCopyPath =>
      copyTargets.push({
        src: path.join(base, additionalCopyPath),
        dest: dist
      })
    );
  }

  const outputs = [
    {
      dir: path.join(dist, "dist"),
      format: "cjs",
      sourcemap: true,
      entryFileNames: "index.js"
    },
    {
      dir: path.join(dist, "dist"),
      format: "esm",
      sourcemap: true,
      entryFileNames: "index.mjs"
    }
  ];

  const jsConfig = {
    input: path.join(base, "src", "index.ts"),
    output: outputs,
    plugins: [
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: path.join(base, "tsconfig.json"),
        outDir: path.join(dist, "dist"),
        declaration: false,
        declarationDir: undefined
      }),
      copy({
        targets: copyTargets
      })
    ],
    external: sharedExternals
  };

  const dtsConfig = {
    input: path.join(base, "src", "index.ts"),
    output: {
      file: path.join(dist, "dist", "index.d.ts"),
      format: "es"
    },
    plugins: [
      dts({
        tsconfig: path.join(base, "tsconfig.json")
      })
    ],
    external: sharedExternals
  };

  return [jsConfig, dtsConfig];
}
