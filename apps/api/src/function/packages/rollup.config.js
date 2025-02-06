import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import fs from "fs";
import path from "path";

export default function getConfig(project) {
  const base = path.join("apps/api/src/function/packages", project);
  const dist = path.join("dist", base);

  function afterBuild() {
    const declarationDir = path.join(dist, dist);
    const distDir = path.join(dist, "dist");

    const operations = [
      {
        src: path.join(declarationDir, "index.d.ts"),
        dest: path.join(distDir, "index.d.ts"),
        action: "copy"
      },
      {
        src: path.join(declarationDir, "src"),
        dest: path.join(distDir, "src"),
        action: "rename"
      },
      {
        src: path.join(distDir, "libs"),
        action: "remove"
      },
      {
        src: path.join(distDir, "apps"),
        action: "remove"
      }
    ];

    operations.forEach(({src, dest, action}) => {
      if (!fs.existsSync(src)) return;

      try {
        if (action === "copy") {
          fs.copyFileSync(src, dest);
        } else if (action === "rename") {
          fs.renameSync(src, dest);
        } else if (action === "remove") {
          fs.rmSync(src, {recursive: true, force: true});
        }
      } catch (e) {
        if (e.code === "ENOTEMPTY" || e.code === "ENOENT") return;
        throw new Error(e);
      }
    });
  }

  const copyTargets = [
    {
      src: path.join(base, "package.json"),
      dest: dist
    }
  ];

  if (project === "database") {
    copyTargets.push({
      src: path.join(base, "scripts"),
      dest: dist
    });
  }

  return {
    input: path.join(base, "src", "index.ts"),
    output: [
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
    ],
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
          afterBuild();
        }
      }
    ],
    external: ["mongodb", "axios", "ws"]
  };
}
