import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, it, mock} from "node:test";
import {
  BASELINE_FILE,
  checkKeyNames,
  countKeyLiterals,
  readBaseline,
  run,
  writeBaseline
} from "./check-key-names.mjs";

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
      write("packages/devkit/database/src/a.ts", content);
      write("apps/panel/src/a.ts", content);
      write("packages/filter/src/a.ts", content);
      write("packages/sync/src/record-key.ts", content);
      write("packages/sync/src/other.ts", content);
      write("packages/data/postgresql/src/a.ts", content);

      assert.deepEqual(countKeyLiterals(root), {
        "packages/data/postgresql/src/a.ts": 1,
        "packages/sync/src/other.ts": 1
      });
    });
  });

  describe("checkKeyNames", () => {
    beforeEach(() => write("packages/api/a/src/a.ts", `a._id;\nb._id;\n`));

    it("should pass when the counts match the baseline", () => {
      const result = checkKeyNames(root, {"packages/api/a/src/a.ts": 2});

      assert.deepEqual(result.grown, []);
      assert.deepEqual(result.shrunk, []);
    });

    it("should report a file whose count grew", () => {
      const result = checkKeyNames(root, {"packages/api/a/src/a.ts": 1});

      assert.deepEqual(result.grown, [{file: "packages/api/a/src/a.ts", count: 2, allowed: 1}]);
    });

    it("should report a file the baseline does not know", () => {
      const result = checkKeyNames(root, {});

      assert.deepEqual(result.grown, [{file: "packages/api/a/src/a.ts", count: 2, allowed: 0}]);
    });

    it("should report a file whose count dropped, so the baseline stays tight", () => {
      const result = checkKeyNames(root, {"packages/api/a/src/a.ts": 3});

      assert.deepEqual(result.shrunk, [{file: "packages/api/a/src/a.ts", count: 2, allowed: 3}]);
    });

    it("should report a baseline entry whose file is gone", () => {
      const result = checkKeyNames(root, {"packages/api/a/src/a.ts": 2, "packages/api/b.ts": 1});

      assert.deepEqual(result.shrunk, [{file: "packages/api/b.ts", count: 0, allowed: 1}]);
    });

    it("should ignore the baseline in strict mode and only look under the path", () => {
      write("packages/api/b/src/b.ts", `b._id;\n`);

      const result = checkKeyNames(
        root,
        {"packages/api/a/src/a.ts": 2},
        {strictUnder: "packages/api/a/"}
      );

      assert.deepEqual(result.grown, [{file: "packages/api/a/src/a.ts", count: 2, allowed: 0}]);
    });

    it("should not match a sibling directory whose name starts the same way", () => {
      write("packages/api/ab/src/b.ts", `b._id;\n`);

      const result = checkKeyNames(root, {}, {strictUnder: "packages/api/a/"});

      assert.deepEqual(
        result.grown.map(({file}) => file),
        ["packages/api/a/src/a.ts"]
      );
    });
  });

  describe("baseline file", () => {
    it("should read an empty baseline when the file does not exist", () => {
      assert.deepEqual(readBaseline(root), {});
    });

    it("should write the entries sorted by path", () => {
      writeBaseline(root, {"packages/b.ts": 1, "apps/a.ts": 2});

      const written = fs.readFileSync(path.join(root, BASELINE_FILE), "utf8");
      assert.equal(written, `{\n  "apps/a.ts": 2,\n  "packages/b.ts": 1\n}\n`);
      assert.deepEqual(readBaseline(root), {"apps/a.ts": 2, "packages/b.ts": 1});
    });
  });

  describe("run", () => {
    beforeEach(() => {
      mock.method(console, "log", () => {});
      mock.method(console, "error", () => {});
      write("packages/api/a/src/a.ts", `a._id;\nb._id;\n`);
    });

    afterEach(() => mock.restoreAll());

    it("should create the baseline when there is none", () => {
      assert.equal(run(root, ["--update"]), 0);
      assert.deepEqual(readBaseline(root), {"packages/api/a/src/a.ts": 2});
    });

    it("should pass against a matching baseline", () => {
      writeBaseline(root, {"packages/api/a/src/a.ts": 2});

      assert.equal(run(root, []), 0);
    });

    it("should fail when a file grew, and not raise the baseline on update", () => {
      writeBaseline(root, {"packages/api/a/src/a.ts": 1});

      assert.equal(run(root, []), 1);
      assert.equal(run(root, ["--update"]), 1);
      assert.deepEqual(readBaseline(root), {"packages/api/a/src/a.ts": 1});
    });

    it("should fail on a stale baseline until it is lowered by update", () => {
      writeBaseline(root, {"packages/api/a/src/a.ts": 3, "packages/api/gone.ts": 1});

      assert.equal(run(root, []), 1);
      assert.equal(run(root, ["--update"]), 0);
      assert.deepEqual(readBaseline(root), {"packages/api/a/src/a.ts": 2});
      assert.equal(run(root, []), 0);
    });

    it("should fail in strict mode while the path still has literals", () => {
      writeBaseline(root, {"packages/api/a/src/a.ts": 2});

      assert.equal(run(root, ["--strict", "--under=packages/api/a/"]), 1);
      assert.equal(run(root, ["--strict", "--under=packages/api/b/"]), 0);
    });

    it("should need a path in strict mode", () => {
      assert.equal(run(root, ["--strict"]), 1);
    });
  });
});
