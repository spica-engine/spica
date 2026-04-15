import {Git} from "../src/versionmanager";
import os from "os";
import fs from "fs";
import path from "path";

describe("Git VersionManager", () => {
  let git: Git;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-test-"));
    git = new Git(tmpDir);
    await git.exec("init", {args: []});
    await git.exec("config", {args: ["user.name", "Spica"]});
    await git.exec("config", {args: ["user.email", "Spica"]});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  describe("sanitizeArgs", () => {
    it("should reject --upload-pack argument", async () => {
      await expect(git.exec("log", {args: ["--upload-pack=/bin/bash"]})).rejects.toThrow(
        'Argument "--upload-pack=/bin/bash" is not allowed'
      );
    });

    it("should reject --upload-pack with separate value", async () => {
      await expect(git.exec("fetch", {args: ["--upload-pack"]})).rejects.toThrow(
        'Argument "--upload-pack" is not allowed'
      );
    });

    it("should reject --receive-pack argument", async () => {
      await expect(git.exec("push", {args: ["--receive-pack=/bin/bash -i"]})).rejects.toThrow(
        'Argument "--receive-pack=/bin/bash -i" is not allowed'
      );
    });

    it("should reject --exec argument", async () => {
      await expect(git.exec("log", {args: ["--exec=whoami"]})).rejects.toThrow(
        'Argument "--exec=whoami" is not allowed'
      );
    });

    it("should reject standalone -c argument", async () => {
      await expect(git.exec("log", {args: ["-c", "core.pager=less"]})).rejects.toThrow(
        'Argument "-c" is not allowed'
      );
    });

    it("should reject --config argument", async () => {
      await expect(git.exec("log", {args: ["--config=core.pager=cat"]})).rejects.toThrow(
        'Argument "--config=core.pager=cat" is not allowed'
      );
    });

    it("should reject --git-dir argument", async () => {
      await expect(git.exec("log", {args: ["--git-dir=/etc"]})).rejects.toThrow(
        'Argument "--git-dir=/etc" is not allowed'
      );
    });

    it("should reject --work-tree argument", async () => {
      await expect(git.exec("log", {args: ["--work-tree=/tmp"]})).rejects.toThrow(
        'Argument "--work-tree=/tmp" is not allowed'
      );
    });

    it("should reject --output argument", async () => {
      await expect(git.exec("diff", {args: ["--output=/tmp/stolen"]})).rejects.toThrow(
        'Argument "--output=/tmp/stolen" is not allowed'
      );
    });

    it("should reject dangerous args case-insensitively", async () => {
      await expect(git.exec("push", {args: ["--RECEIVE-PACK=/bin/bash"]})).rejects.toThrow(
        "is not allowed"
      );
    });

    it("should reject arguments with null bytes", async () => {
      await expect(
        git.exec("log", {args: ["--oneline\x00--upload-pack=/bin/bash"]})
      ).rejects.toThrow("contains disallowed control characters");
    });

    it("should reject arguments with control characters", async () => {
      await expect(git.exec("log", {args: ["\x01evil"]})).rejects.toThrow(
        "contains disallowed control characters"
      );
    });

    it("should reject non-array args", async () => {
      await expect(git.exec("log", {args: "--oneline"})).rejects.toThrow(
        "Arguments must be an array"
      );
    });

    it("should reject non-string elements in args", async () => {
      await expect(git.exec("log", {args: [123]})).rejects.toThrow(
        "Argument at index 0 must be a string"
      );
    });

    it("should reject object elements in args", async () => {
      await expect(git.exec("log", {args: [{cmd: "evil"}]})).rejects.toThrow(
        "Argument at index 0 must be a string"
      );
    });

    it("should reject boolean elements in args", async () => {
      await expect(git.exec("log", {args: [true]})).rejects.toThrow(
        "Argument at index 0 must be a string"
      );
    });

    it("should treat missing args as empty array", async () => {
      // add with no args should not throw from sanitization
      // (git itself may error, but sanitization passes)
      await expect(git.exec("log", {})).rejects.not.toThrow("Arguments must be an array");
    });

    it("should treat null args as empty array", async () => {
      await expect(git.exec("log", {args: null})).rejects.not.toThrow("Arguments must be an array");
    });

    it("should allow legitimate args", async () => {
      // Create a file so we can test add
      fs.writeFileSync(path.join(tmpDir, "test.txt"), "hello");
      await expect(git.exec("add", {args: ["."]})).resolves.toBeDefined();
    });

    it("should allow branch flags", async () => {
      // Create initial commit so branch operations work
      fs.writeFileSync(path.join(tmpDir, "init.txt"), "init");
      await git.exec("add", {args: ["."]});
      await git.exec("commit", {args: ["'initial commit'"]});

      const result = await git.exec("branch", {args: ["-a"]});
      expect(result).toBeDefined();
    });
  });

  describe("exec", () => {
    it("should reject unknown commands", async () => {
      await expect(git.exec("clone", {args: []})).rejects.toBe("Unknown command clone");
    });

    it("should return sorted available commands", () => {
      const commands = git.availables();
      expect(commands).toEqual([...commands].sort());
      expect(commands).toContain("add");
      expect(commands).toContain("commit");
      expect(commands).toContain("push");
      expect(commands).not.toContain("clone");
    });
  });
});
