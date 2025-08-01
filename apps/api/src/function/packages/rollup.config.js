import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import fs from "fs";
import path from "path";

let bundleCount = 0;

export function cleanUp(path) {
  if (fs.existsSync(path)) {
    fs.rmSync(path, {recursive: true, force: true});
  }
}

export default function getConfig(project, additionalCopyPaths = []) {
  const base = path.join("apps/api/src/function/packages", project);
  const dist = path.join("dist", base);

  cleanUp(dist);

  function afterBuild() {
    const declarationDir = path.join(dist, dist);
    const packageDist = path.join(dist, "dist");

    const operations = [
      {
        src: path.join(declarationDir, "index.d.ts"),
        dest: path.join(packageDist, "index.d.ts"),
        action: "copy"
      },
      {
        src: path.join(declarationDir, "src"),
        dest: path.join(packageDist, "src"),
        action: "rename"
      },
      {
        src: path.join(packageDist, "libs"),
        action: "remove"
      },
      {
        src: path.join(packageDist, "apps"),
        action: "remove"
      }
    ];

    operations.forEach(({src, dest, action}) => {
      if (!fs.existsSync(src)) return;
      if (action === "copy") {
        fs.copyFileSync(src, dest);
      } else if (action === "rename") {
        fs.renameSync(src, dest);
      } else if (action === "remove") {
        fs.rmSync(src, {recursive: true, force: true});
      }
    });
  }

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

  return {
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
        outDir: path.join(dist, "dist")
      }),
      copy({
        targets: copyTargets
      }),
      {
        name: "after-build-plugin",
        writeBundle() {
          bundleCount++;
          if (bundleCount == outputs.length) {
            afterBuild();
          }
        }
      }
    ],
    external: ["mongodb", "axios", "ws", "tus-js-client"]
  };
}
