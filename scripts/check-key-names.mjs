#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {stripComments} from "./check-data-boundary.mjs";

const SCANNED_ROOTS = ["packages", "apps"];

const EXEMPT_PREFIXES = [
  "packages/data/mongodb/",
  "packages/database/",
  "packages/interface/database/",
  "packages/devkit/database/",
  "packages/devkit/internal_common/src/key.ts",
  "packages/devkit/auth/test/id.spec.ts",
  "packages/devkit/identity/test/id.spec.ts",
  "packages/devkit/storage/test/id.spec.ts",
  "packages/devkit/testing/",
  "packages/filter/",
  "packages/data/postgresql/src/schemas/bucket.schema.json",
  "packages/api/bucket/graphql/",
  "packages/api/bucket/expression/src/convert.ts",
  "packages/api/bucket/expression/src/builtin_funcs.ts",
  "packages/devkit/bucket/",
  "packages/devkit/auth/src/interface.ts",
  "packages/devkit/identity/src/interface.ts",
  "packages/devkit/storage/src/interface.ts",
  "packages/interface/function/packages/",
  "apps/cli/src/commands/bucket/orm.ts",
  "apps/cli/src/commands/project/start.ts",
  "packages/sync/src/record-key.ts",
  "packages/sync/test/record-key.spec.ts",
  "apps/migrate/",
  "apps/mongoreplicationcontroller/",
  "apps/panel/src/utils/recordKey.ts",
  "apps/panel/src/utils/recordKey.spec.ts",
  "apps/panel/src/types/storage.ts"
];

const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "fixtures", ".nx", "coverage"]);

const IGNORED_JSON = /(^|\/)(package|project|tsconfig[\w.-]*|jest[\w.-]*)\.json$/;

const MONGO_ONLY_SPEC = /(^|[^\w$.])mongoOnly\(/;

const KEY_LITERAL = /(?<![\w$])_id(?![\w$])/g;

export function countKeyLiterals(root) {
  const counts = {};
  for (const scanned of SCANNED_ROOTS) {
    const directory = path.join(root, scanned);
    if (!fs.existsSync(directory)) {
      continue;
    }
    for (const file of sourceFiles(root, directory)) {
      const relative = toPosix(path.relative(root, file));
      const text = fs.readFileSync(file, "utf8");
      if (MONGO_ONLY_SPEC.test(text)) {
        continue;
      }
      const code = file.endsWith(".json") ? text : stripComments(text);
      const count = (code.match(KEY_LITERAL) || []).length;
      if (count) {
        counts[relative] = count;
      }
    }
  }
  return counts;
}

function* sourceFiles(root, directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const full = path.join(directory, entry.name);
    const relative = toPosix(path.relative(root, full));
    if (EXEMPT_PREFIXES.some(prefix => (relative + "/").startsWith(prefix))) {
      continue;
    }
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        yield* sourceFiles(root, full);
      }
    } else if (isScanned(entry.name)) {
      yield full;
    }
  }
}

function isScanned(name) {
  if (name.endsWith(".json")) {
    return !IGNORED_JSON.test(name);
  }
  return (name.endsWith(".ts") && !name.endsWith(".d.ts")) || name.endsWith(".tsx");
}

function toPosix(file) {
  return file.split(path.sep).join("/");
}

export function run(root) {
  const counts = countKeyLiterals(root);
  const files = Object.keys(counts);
  for (const file of files) {
    console.error(`${file}: ${counts[file]} "_id" literal(s)`);
  }
  if (files.length) {
    console.error(
      `\n${files.length} file(s) name the key literally. Use ids().systemKeyField(), idOf, ` +
        `withId and omitId from @spica-server/data (documentKey for bucket documents), or keyFieldOf ` +
        `from @spica-server/database-testing in specs, instead.`
    );
    return 1;
  }
  console.log("Key name check passed.");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) == fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  process.exit(run(root));
}
