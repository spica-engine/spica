#!/usr/bin/env node
/**
 * Compares the hand-written system table definitions with the interfaces they are derived from (D14).
 *
 * Why this exists: the definitions in `postgres/src/schema/system-tables.ts` were written by hand against
 * the `packages/interface/*` documents, and that produced the **same class of defect five times** (R17, R58,
 * R69, R71, R106). R71 audited all 24 by eye and still missed the fifth: `function_logs.level` was declared
 * `string` while `LogLevels` is a numeric enum, so the value came back as `"4"` and filtering by level
 * returned nothing. Reading carefully is not a control; this is.
 *
 * What it checks, per definition:
 *   - a declared property that the interface does not have  → the column is dead, nothing ever writes it
 *   - a required interface field that is not declared        → the write either disappears into the overflow
 *                                                              column or is rejected outright
 *   - a type that disagrees with the interface's            → the value comes back in the wrong shape
 *
 * What it cannot check: whether a document nests a field the definition flattens. That needs the writer, not
 * the type — `webhook_logs` (R71) was exactly that, and the field-presence check above catches its symptom.
 *
 * Usage:  node scripts/audit-system-tables.mjs          (exit 1 when anything is reported)
 *         node scripts/audit-system-tables.mjs --json    (machine-readable)
 */
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFINITIONS = path.join(ROOT, "packages/database/postgres/src/schema/system-tables.ts");

/**
 * Which interface each definition is derived from. Written out rather than derived: the names do not follow
 * a rule (`policies` ↔ `Policy`, `function_logs` ↔ `Log`, `jobs` ↔ `JobMeta`), and guessing would make the
 * audit quietly skip what it cannot resolve — the one thing it must not do.
 */
const SOURCES = {
  buckets: ["packages/interface/bucket/src/bucket.ts", "Bucket"],
  preferences: ["packages/interface/preference/src/index.ts", "Preference"],
  identity: ["packages/interface/passport/identity/src/index.ts", "Identity"],
  user: ["packages/interface/passport/user/src/index.ts", "User"],
  verification: ["packages/interface/passport/user/src/index.ts", "UserVerification"],
  refresh_token: ["packages/interface/passport/refresh_token/src/index.ts", "RefreshToken"],
  apikey: ["packages/interface/passport/apikey/src/index.ts", "ApiKey"],
  policies: ["packages/interface/passport/policy/src/index.ts", "Policy"],
  activity: ["packages/interface/activity/src/index.ts", "Activity"],
  status: ["packages/interface/status/src/services.ts", "ApiStatus"],
  function_logs: ["packages/interface/function/log/src/index.ts", "Log"],
  webhook: ["packages/interface/function/webhook/src/index.ts", "Webhook"],
  webhook_logs: ["packages/interface/function/webhook/src/index.ts", "Log"],
  function: ["packages/interface/function/src/function.ts", "Function"],
  env_var: ["packages/interface/env_var/src/index.ts", "EnvVar"],
  secret: ["packages/interface/secret/src/index.ts", "Secret"],
  dashboard: ["packages/interface/dashboard/src/index.ts", "Dashboard"],
  asset: ["packages/interface/asset/src/index.ts", "Asset"],
  storage: ["packages/interface/storage/src/body.ts", "StorageObject"],
  jobs: ["packages/interface/replication/src/index.ts", "JobMeta"],
  commands: ["packages/interface/replication/src/index.ts", "CommandMessage"],
  function_assets: ["packages/interface/function/asset-storage/src/asset.ts", "FunctionAsset"],
  history: ["packages/interface/bucket/history/src/index.ts", "History"]
};

/**
 * Definitions with no interface of their own, and why. Listed rather than omitted so that adding a
 * definition without a source is a deliberate act.
 */
const NO_SOURCE = {
  strategy:
    "the OAuth/SAML strategy document is assembled per provider; no single interface describes it",
  config: "a module name plus an opaque options blob — `options` is by definition unshaped"
};

/**
 * Declared columns and missing fields that are correct as they are. Every entry carries its reason; an
 * unexplained waiver is how an audit turns into a rubber stamp.
 */
const WAIVERS = {
  "storage.url": "computed as a signed link on every read, never stored (R71)",
  "verification.createdAt": "kept for records written before the rename to `created_at` (D12)",
  "buckets._id": "the primary key is implicit in every table",
  "identity.identifier": "present; the interface marks it required and the definition declares it",
  "storage.content":
    "the document nests `content.{type,size}`; the definition flattens it deliberately",
  /**
   * These two ask for retention (`upsertTTLIndex` in their service's `afterInit`) and **no writer sets the
   * field**, so the retention never takes effect — the same defect D12 fixed in `verification`, in two more
   * services. `jobs` is in the same position and is not reported only because `JobMeta` has an index
   * signature. Waived rather than silently fixed: making it work starts deleting rows in three services, so
   * it is a behaviour decision. Recorded as **D29**.
   */
  "status.created_at": "retention asked for, never written — D29",
  "commands.created_at": "retention asked for, never written — D29"
};

/** Marks an interface that accepts arbitrary fields through an index signature. */
const OPEN = Symbol("open");

function read(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return undefined;
  return ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
}

/** The definitions, read from the source rather than imported: no build step, no stale `dist`. */
function readDefinitions() {
  const source = read(path.relative(ROOT, DEFINITIONS));
  const tables = [];

  const visit = node => {
    if (
      ts.isObjectLiteralExpression(node) &&
      node.properties.some(p => p.name?.getText() === "name") &&
      node.properties.some(p => p.name?.getText() === "properties")
    ) {
      const name = node.properties
        .find(p => p.name?.getText() === "name")
        .initializer.getText()
        .replace(/['"]/g, "");
      const properties = {};
      const block = node.properties.find(p => p.name?.getText() === "properties").initializer;

      if (ts.isObjectLiteralExpression(block)) {
        for (const property of block.properties) {
          if (!property.name) continue;
          const field = property.name.getText().replace(/['"]/g, "");
          const type = /type:\s*['"]([a-zA-Z]+)['"]/.exec(property.initializer.getText())?.[1];
          properties[field] = type;
        }
      }
      tables.push({name, properties});
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return tables;
}

/** The interface's own fields: name → {optional, type text}. Inherited members are followed. */
function readInterface(file, name, seen = new Set()) {
  const source = read(file);
  if (!source) return undefined;

  let found;
  ts.forEachChild(source, node => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) found = node;
  });
  if (!found) return undefined;

  const fields = {};

  for (const clause of found.heritageClauses ?? []) {
    for (const parent of clause.types) {
      const parentName = parent.expression.getText();
      if (seen.has(parentName)) continue;
      seen.add(parentName);
      Object.assign(fields, readInterface(file, parentName, seen) ?? {});
    }
  }

  for (const member of found.members) {
    /**
     * `[key: string]: any` means the interface takes any field, so "this column is not a field" cannot be
     * said about it — `JobMeta` is written exactly that way, and the callers put a resume token or a
     * `uniqid()` in it.
     */
    if (ts.isIndexSignatureDeclaration(member)) {
      fields[OPEN] = true;
      continue;
    }
    if (!ts.isPropertySignature(member) || !member.name) continue;
    fields[member.name.getText().replace(/['"]/g, "")] = {
      optional: !!member.questionToken,
      type: member.type?.getText() ?? "unknown"
    };
  }

  return fields;
}

/**
 * Which definition types a TypeScript type may legitimately map to.
 *
 * Deliberately generous where the mapping really is one-to-many (a `string` field can be `string`,
 * `textarea`, `richtext` or a `relation` carrying an id) and strict where it is not — which is the case that
 * bit: a numeric enum is `number`, never `string`.
 */
function allowedFor(typeText, enums) {
  const type = typeText.replace(/\s/g, "");

  // `any` and `unknown` say nothing about the shape, so they rule nothing out.
  if (type === "any" || type === "unknown") return undefined;

  if (/\[\]$/.test(type) || /^Array</.test(type)) return ["array", "relation", "json"];
  if (type === "boolean") return ["boolean"];
  if (type === "number") return ["number"];
  if (type === "Date" || type === "Date|string") return ["date"];
  if (type === "ObjectId") return ["relation", "objectid", "string"];
  if (type === "string") return ["string", "textarea", "richtext", "relation", "color"];

  const enumKind = enums.get(type);
  if (enumKind === "number") return ["number"];
  if (enumKind === "string") return ["string", "textarea"];

  // A union of string literals is a string; anything else is a shape, i.e. json.
  if (/^(['"][^'"]*['"]\|?)+$/.test(type)) return ["string"];
  return ["json", "object", "location", "storage", "relation", "array", "string"];
}

/** Numeric vs string enums across the interface packages — the distinction R106 turned on. */
function readEnums() {
  const enums = new Map();
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "dist" && entry.name !== "node_modules") walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;

      const source = ts.createSourceFile(
        full,
        fs.readFileSync(full, "utf8"),
        ts.ScriptTarget.Latest,
        true
      );
      ts.forEachChild(source, node => {
        if (!ts.isEnumDeclaration(node)) return;
        const hasStringMember = node.members.some(
          member => member.initializer && ts.isStringLiteral(member.initializer)
        );
        enums.set(node.name.text, hasStringMember ? "string" : "number");
      });
    }
  };
  walk(path.join(ROOT, "packages/interface"));
  return enums;
}

// ─────────────────────────────────────────────────────────────────── the audit

const enums = readEnums();
const findings = [];

for (const {name, properties} of readDefinitions()) {
  if (NO_SOURCE[name]) continue;

  const source = SOURCES[name];
  if (!source) {
    findings.push({
      table: name,
      kind: "no-source",
      detail: "no interface mapped; add it to SOURCES or NO_SOURCE"
    });
    continue;
  }

  const fields = readInterface(source[0], source[1]);
  if (!fields) {
    findings.push({
      table: name,
      kind: "unreadable",
      detail: `${source[1]} not found in ${source[0]}`
    });
    continue;
  }

  for (const [field, declared] of Object.entries(properties)) {
    if (WAIVERS[`${name}.${field}`]) continue;
    if (!fields[field]) {
      if (fields[OPEN]) continue;
      findings.push({
        table: name,
        kind: "dead-column",
        detail: `'${field}' is not a field of ${source[1]}`
      });
      continue;
    }
    const allowed = allowedFor(fields[field].type, enums);
    if (declared && allowed && !allowed.includes(declared)) {
      findings.push({
        table: name,
        kind: "type-mismatch",
        detail: `'${field}' is declared '${declared}' but ${source[1]}.${field} is '${fields[field].type}' (expected one of ${allowed.join(", ")})`
      });
    }
  }

  for (const [field, info] of Object.entries(fields)) {
    if (info.optional || field === "_id") continue;
    if (WAIVERS[`${name}.${field}`] || properties[field] !== undefined) continue;
    findings.push({
      table: name,
      kind: "missing-column",
      detail: `${source[1]}.${field} is required but no column is declared`
    });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({findings}, null, 1));
} else if (!findings.length) {
  console.log(`✔ ${Object.keys(SOURCES).length} definitions agree with their interfaces`);
} else {
  for (const finding of findings) {
    console.log(`✘ ${finding.table.padEnd(16)} ${finding.kind.padEnd(15)} ${finding.detail}`);
  }
  console.log(`\n${findings.length} finding(s)`);
}

process.exit(findings.length ? 1 : 0);
