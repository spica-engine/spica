import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, it, mock} from "node:test";
import {countKeyLiterals, run} from "./check-key-names.mjs";

describe("check-key-names", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "key-names-"));
  });

  afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

  function write(file, content) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), {recursive: true});
    fs.writeFileSync(full, content);
  }

  describe("countKeyLiterals", () => {
    it("should count property reads, object keys and string literals", () => {
      write(
        "packages/api/a/src/a.ts",
        `const a = identity._id;\nconst b = {_id: 1};\nconst c = "_id";\nconst d = '._id';\n`
      );

      assert.deepEqual(countKeyLiterals(root), {"packages/api/a/src/a.ts": 4});
    });

    it("should not count names that only contain the key", () => {
      write(
        "packages/api/a/src/a.ts",
        `const a = {bucket_id: 1, document_id: 2, _identity: 3, $_id: 4, _id2: 5};\n`
      );

      assert.deepEqual(countKeyLiterals(root), {});
    });

    it("should not count comments", () => {
      write("packages/api/a/src/a.ts", `// _id\n/* _id */\nconst a = 1; // keyed by _id\n`);

      assert.deepEqual(countKeyLiterals(root), {});
    });

    it("should count specs, tests and json schemas", () => {
      write("packages/api/a/src/a.spec.ts", `expect(a._id).toBe(1);\n`);
      write("packages/api/a/test/a.ts", `a._id;\n`);
      write("packages/api/a/src/schema.json", `{"properties": {"_id": {}}}\n`);

      assert.deepEqual(countKeyLiterals(root), {
        "packages/api/a/src/a.spec.ts": 1,
        "packages/api/a/test/a.ts": 1,
        "packages/api/a/src/schema.json": 1
      });
    });

    it("should skip declaration files, build output, fixtures and config json", () => {
      const content = `a._id;\n`;
      write("packages/api/a/src/a.d.ts", content);
      write("packages/api/a/dist/a.ts", content);
      write("packages/api/a/node_modules/b/a.ts", content);
      write("packages/api/a/test/fixtures/a.json", `{"_id": 1}`);
      write("packages/api/a/package.json", `{"_id": 1}`);
      write("packages/api/a/tsconfig.spec.json", `{"_id": 1}`);

      assert.deepEqual(countKeyLiterals(root), {});
    });

    it("should skip the places where the key name is the engine's own", () => {
      const content = `a._id;\n`;
      write("packages/data/mongodb/src/a.ts", content);
      write("packages/database/src/a.ts", content);
      write("packages/interface/database/src/a.ts", content);
      write("packages/devkit/database/src/a.ts", content);
      write("apps/panel/src/utils/recordKey.ts", content);
      write("packages/filter/src/a.ts", content);
      write("packages/api/bucket/graphql/src/a.ts", content);
      write("packages/devkit/bucket/src/a.ts", content);
      write("packages/sync/src/record-key.ts", content);
      write("packages/devkit/internal_common/src/key.ts", content);
      write("packages/devkit/identity/test/id.spec.ts", content);
      write("packages/sync/src/other.ts", content);
      write("packages/data/postgresql/src/a.ts", content);

      assert.deepEqual(countKeyLiterals(root), {
        "packages/data/postgresql/src/a.ts": 1,
        "packages/sync/src/other.ts": 1
      });
    });

    it("should scan the panel's components and pages, not only its helpers", () => {
      write("apps/panel/src/utils/recordKey.ts", `a._id;\n`);
      write("apps/panel/src/pages/Bucket.tsx", `a._id;\n`);
      write("apps/panel/src/hooks/useThing.ts", `a._id;\n`);

      assert.deepEqual(countKeyLiterals(root), {
        "apps/panel/src/pages/Bucket.tsx": 1,
        "apps/panel/src/hooks/useThing.ts": 1
      });
    });
  });

  describe("run", () => {
    beforeEach(() => {
      mock.method(console, "log", () => {});
      mock.method(console, "error", () => {});
    });

    afterEach(() => mock.restoreAll());

    it("should pass when nothing names the key", () => {
      write("packages/api/a/src/a.ts", `const a = 1;\n`);

      assert.equal(run(root), 0);
    });

    it("should fail on a literal in source", () => {
      write("packages/api/a/src/a.ts", `a._id;\n`);

      assert.equal(run(root), 1);
    });

    it("should fail on a literal in a spec", () => {
      write("packages/api/a/test/a.spec.ts", `expect(a._id).toBe(1);\n`);

      assert.equal(run(root), 1);
    });

    it("should pass for a spec that declares itself mongoOnly", () => {
      write(
        "packages/api/a/test/a.spec.ts",
        `contractSuite("a", () => mongoOnly("uses operators"));\nexpect(a._id).toBe(1);\n`
      );

      assert.equal(run(root), 0);
    });

    it("should still count a spec that only mentions mongoOnly in a name", () => {
      write("packages/api/a/test/a.spec.ts", `const notMongoOnly = 1;\nexpect(a._id).toBe(1);\n`);

      assert.equal(run(root), 1);
    });
  });
});
