import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, it} from "node:test";
import {checkDataBoundary} from "./check-data-boundary.mjs";

describe("checkDataBoundary", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "data-boundary-"));
  });

  afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

  function write(file, content) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), {recursive: true});
    fs.writeFileSync(full, content);
  }

  const check = options =>
    checkDataBoundary(root, options).map(({file, line, subject}) => `${file}:${line} ${subject}`);

  it("should report MongoDB driver imports outside the adapter", () => {
    write(
      "packages/api/a/src/a.ts",
      `import {Filter} from "mongodb";\nimport {x} from "bson/y";\n`
    );
    write("packages/data/mongodb/src/a.ts", `import {Filter} from "mongodb";\n`);
    write("packages/database/src/a.ts", `import {Filter} from "mongodb";\n`);

    assert.deepEqual(check(), [
      "packages/api/a/src/a.ts:1 mongodb",
      "packages/api/a/src/a.ts:2 bson/y"
    ]);
  });

  it("should skip specs, test and testing directories and declaration files", () => {
    const content = `import {ObjectId} from "mongodb";\nnew ObjectId();\n`;
    write("packages/api/a/test/a.ts", content);
    write("packages/api/a/testing/a.ts", content);
    write("packages/api/a/src/a.spec.ts", content);
    write("packages/api/a/src/a.d.ts", content);
    write("packages/api/a/dist/a.ts", content);
    write("apps/migrate/src/a.ts", content);

    assert.deepEqual(check(), []);
  });

  it("should report the database packages but allow the realtime gateway exports", () => {
    write(
      "packages/api/a/src/a.ts",
      [
        `import {DatabaseService} from "@spica-server/database";`,
        `import {PipelineBuilder} from "@spica-server/database-pipeline";`,
        `import {RealtimeDatabaseService, RealtimeDatabaseModule} from "@spica-server/database-realtime";`,
        `import {Emitter} from "@spica-server/database-realtime";`
      ].join("\n")
    );

    assert.deepEqual(check(), [
      "packages/api/a/src/a.ts:1 @spica-server/database",
      "packages/api/a/src/a.ts:2 @spica-server/database-pipeline",
      "packages/api/a/src/a.ts:4 @spica-server/database-realtime",
      "packages/api/a/src/a.ts:1 DatabaseService"
    ]);
  });

  it("should allow the MongoDB adapter only where it is registered", () => {
    const content = `import {MongoDataAdapter} from "@spica-server/data-mongodb";\n`;
    write("apps/api/src/main.ts", content);
    write("packages/api/a/src/a.ts", content);

    assert.deepEqual(check(), ["packages/api/a/src/a.ts:1 @spica-server/data-mongodb"]);
  });

  it("should report forbidden identifiers in code but not in comments, strings or keys", () => {
    write(
      "packages/api/a/src/a.ts",
      [
        `// new ObjectId() in a comment`,
        `/* BaseCollection */ const a = "ObjectId(x)";`,
        "const b = `scalar ObjectId ${'DatabaseService'}`;",
        `const c = {ObjectId: v => v, RealtimeDatabaseService: 1};`,
        `const quote = /'/g;`,
        `const id = new ObjectId();`,
        "const d = `${new BaseCollection()}`;"
      ].join("\n")
    );

    assert.deepEqual(check(), [
      "packages/api/a/src/a.ts:6 ObjectId",
      "packages/api/a/src/a.ts:7 BaseCollection"
    ]);
  });

  it("should skip allowlisted violations only for the listed subjects", () => {
    write("packages/api/a/src/a.ts", `import {ObjectId} from "bson";\nnew ObjectId();\n`);

    assert.deepEqual(check({allowlist: [{file: "packages/api/a/src/a.ts", match: ["bson"]}]}), [
      "packages/api/a/src/a.ts:1 ObjectId",
      "packages/api/a/src/a.ts:2 ObjectId"
    ]);
  });
});
