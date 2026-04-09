#!/usr/bin/env node

/**
 * Custom Nx prune script.
 *
 * Collects every transitive workspace dependency of a target project,
 * copies only `package.json` + `dist/` for each into
 *   <target-dist>/workspace_modules/<npm-name>/
 * and rewrites all `workspace:*` references to `file:` paths.
 *
 * Usage:
 *   node scripts/prune.mjs <project>
 *   node scripts/prune.mjs api --graph-file=graph.json
 */

import {execSync} from "node:child_process";
import {cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {dirname, join, relative} from "node:path";
import {tmpdir} from "node:os";

const WORKSPACE_MODULES = "workspace_modules";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let targetProject;
  let graphFile;

  for (const arg of args) {
    if (arg.startsWith("--graph-file=")) {
      graphFile = arg.slice("--graph-file=".length);
    } else if (!arg.startsWith("-")) {
      targetProject = arg;
    }
  }

  if (!targetProject) {
    console.error("Usage: node scripts/prune.mjs <project-name> [--graph-file=path]");
    console.error("  e.g. node scripts/prune.mjs api");
    process.exit(1);
  }

  return {targetProject, graphFile};
}

// ---------------------------------------------------------------------------
// Phase 1 – Dependency graph
// ---------------------------------------------------------------------------

function loadGraph(workspaceRoot, targetProject, graphFile) {
  let filePath = graphFile;

  if (!filePath) {
    filePath = join(tmpdir(), `nx-graph-${Date.now()}.json`);
    console.log("Generating Nx dependency graph...");
    try {
      execSync(`npx nx graph --file=${filePath} --focus=${targetProject}`, {
        cwd: workspaceRoot,
        stdio: ["pipe", "pipe", "inherit"]
      });
    } catch {
      console.error("Failed to run `npx nx graph`. Is Nx installed?");
      process.exit(1);
    }
  }

  const data = JSON.parse(readFileSync(filePath, "utf8"));

  // Clean up temp file (only if we generated it)
  if (!graphFile) rmSync(filePath, {force: true});

  return data.graph; // { nodes, dependencies }
}

// ---------------------------------------------------------------------------
// Phase 2 – BFS to collect transitive dependencies
// ---------------------------------------------------------------------------

function collectTransitiveDeps(target, dependencies) {
  const visited = new Set();
  const queue = [target];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of dependencies[current] || []) {
      if (!visited.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  visited.delete(target); // handled separately
  return visited;
}

// ---------------------------------------------------------------------------
// Phase 3 – Build npm-name → source-root mapping
// ---------------------------------------------------------------------------

function buildDepMap(nxNames, nodes, workspaceRoot) {
  /** @type {Map<string, string>} npmName → rootPath (relative to workspace) */
  const depMap = new Map();

  for (const nxName of nxNames) {
    const node = nodes[nxName];
    if (!node) {
      console.warn(`  warn: node "${nxName}" not found in graph, skipping`);
      continue;
    }

    // Skip nodes that have no build target — they produce no dist/ output
    if (!node.data.targets || !("build" in node.data.targets)) {
      continue;
    }

    const rootPath = node.data.root;
    const pkgJsonPath = join(workspaceRoot, rootPath, "package.json");

    if (!existsSync(pkgJsonPath)) {
      console.warn(`  warn: no package.json at ${rootPath}, skipping`);
      continue;
    }

    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    if (!pkg.name) {
      console.warn(`  warn: no "name" in ${rootPath}/package.json, skipping`);
      continue;
    }

    depMap.set(pkg.name, rootPath);
  }

  return depMap;
}

// ---------------------------------------------------------------------------
// Phase 4 – Copy dependency artifacts
// ---------------------------------------------------------------------------

function copyDependencies(depMap, workspaceRoot, wmDir) {
  let copied = 0;
  let missingDist = 0;

  for (const [npmName, rootPath] of depMap) {
    const srcDir = join(workspaceRoot, rootPath);
    const destDir = join(wmDir, npmName);

    mkdirSync(destDir, {recursive: true});

    // package.json
    cpSync(join(srcDir, "package.json"), join(destDir, "package.json"));

    // dist/
    const srcDist = join(srcDir, "dist");
    if (existsSync(srcDist)) {
      cpSync(srcDist, join(destDir, "dist"), {recursive: true});
    } else {
      console.warn(`  warn: ${npmName} has no dist/ folder (not built?)`);
      missingDist++;
    }

    copied++;
  }

  return {copied, missingDist};
}

// ---------------------------------------------------------------------------
// Phase 5 – Rewrite package.json files
// ---------------------------------------------------------------------------

function isWorkspaceRef(version) {
  return typeof version === "string" && version.startsWith("workspace:");
}

/**
 * Rewrite `workspace:*` entries in a deps object.
 * @param {Record<string,string>} deps      – dependencies map (mutated in place)
 * @param {string}                currentDir – absolute dir of the package.json being rewritten
 * @param {Map<string,string>}    depMap     – npm name → root path
 * @param {string}                wmDir      – absolute path to workspace_modules
 * @param {string}                label      – for warning messages
 */
function rewriteDeps(deps, currentDir, depMap, wmDir, label) {
  for (const [name, version] of Object.entries(deps)) {
    if (!isWorkspaceRef(version)) continue;

    if (depMap.has(name)) {
      const targetDir = join(wmDir, name);
      const rel = relative(currentDir, targetDir).split("\\").join("/");
      deps[name] = `file:${rel}`;
    } else {
      console.warn(`  warn: ${label} depends on ${name} (${version}) which is not in the graph`);
    }
  }
}

function rewriteDepPackageJsons(depMap, wmDir) {
  for (const [npmName] of depMap) {
    const pkgPath = join(wmDir, npmName, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const currentDir = dirname(pkgPath);

    if (pkg.dependencies) {
      rewriteDeps(pkg.dependencies, currentDir, depMap, wmDir, npmName);
    }

    delete pkg.devDependencies;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
}

function copyAndRewriteTargetPackageJson(workspaceRoot, targetRoot, targetDist, depMap) {
  const src = join(workspaceRoot, targetRoot, "package.json");
  const dst = join(targetDist, "package.json");

  cpSync(src, dst);

  const pkg = JSON.parse(readFileSync(dst, "utf8"));

  if (pkg.dependencies) {
    for (const [name, version] of Object.entries(pkg.dependencies)) {
      if (!isWorkspaceRef(version)) continue;

      if (depMap.has(name)) {
        pkg.dependencies[name] = `file:./${WORKSPACE_MODULES}/${name}`;
      } else {
        console.warn(`  warn: target depends on ${name} (${version}) which is not in the graph`);
      }
    }
  }

  delete pkg.devDependencies;
  writeFileSync(dst, JSON.stringify(pkg, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Phase 6 – Validation
// ---------------------------------------------------------------------------

function validate(targetDist, wmDir, depMap) {
  let errors = 0;

  const check = (pkgPath, label) => {
    if (!existsSync(pkgPath)) return;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const dir = dirname(pkgPath);

    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      if (typeof version !== "string") continue;

      if (version.startsWith("workspace:")) {
        console.error(`  FAIL: ${label} -> ${name} still has ${version}`);
        errors++;
      }

      if (version.startsWith("file:")) {
        const resolved = join(dir, version.slice(5));
        if (!existsSync(resolved)) {
          console.error(`  FAIL: ${label} -> ${name} -> ${version} (path not found)`);
          errors++;
        }
      }
    }
  };

  check(join(targetDist, "package.json"), "target");

  for (const [npmName] of depMap) {
    check(join(wmDir, npmName, "package.json"), npmName);
  }

  if (errors === 0) {
    console.log("  All file: references are valid.");
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const {targetProject, graphFile} = parseArgs();
  const workspaceRoot = process.cwd();

  // 1. Load graph
  const {nodes, dependencies} = loadGraph(workspaceRoot, targetProject, graphFile);

  if (!nodes[targetProject]) {
    console.error(`Project "${targetProject}" not found in the dependency graph.`);
    const available = Object.keys(nodes)
      .filter(k => !k.endsWith("/test"))
      .sort();
    console.error("Available projects:\n  " + available.join("\n  "));
    process.exit(1);
  }

  // 2. Collect transitive deps
  console.log(`Resolving transitive dependencies for "${targetProject}"...`);
  const nxDeps = collectTransitiveDeps(targetProject, dependencies);

  // 3. Map nx names → npm names + root paths
  const depMap = buildDepMap(nxDeps, nodes, workspaceRoot);
  console.log(`Found ${depMap.size} workspace dependencies.`);

  // 4. Prepare output directory
  const targetRoot = nodes[targetProject].data.root;
  const targetDist = join(workspaceRoot, targetRoot, "dist");

  if (!existsSync(targetDist)) {
    console.error(`Target dist not found: ${relative(workspaceRoot, targetDist)}`);
    console.error(`Build first:  yarn nx build ${targetProject}`);
    process.exit(1);
  }

  const wmDir = join(targetDist, WORKSPACE_MODULES);

  if (existsSync(wmDir)) {
    console.log("Cleaning previous workspace_modules...");
    rmSync(wmDir, {recursive: true, force: true});
  }

  // 5. Copy package.json + dist/ for every dependency
  console.log("Copying dependencies...");
  const {copied, missingDist} = copyDependencies(depMap, workspaceRoot, wmDir);

  // 6. Rewrite workspace:* → file: in dependency package.jsons
  console.log("Rewriting workspace references in dependencies...");
  rewriteDepPackageJsons(depMap, wmDir);

  // 7. Copy + rewrite target project package.json
  console.log("Copying target package.json...");
  copyAndRewriteTargetPackageJson(workspaceRoot, targetRoot, targetDist, depMap);

  // 8. Validate
  console.log("\nValidating...");
  const errors = validate(targetDist, wmDir, depMap);

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Target:       ${targetProject} (${targetRoot})`);
  console.log(`Output:       ${relative(workspaceRoot, targetDist)}`);
  console.log(`Dependencies: ${copied}`);
  if (missingDist > 0) console.log(`Missing dist: ${missingDist}`);
  if (errors > 0) console.log(`Errors:       ${errors}`);

  if (errors > 0) process.exit(1);
  console.log("\nDone.");
}

main();
