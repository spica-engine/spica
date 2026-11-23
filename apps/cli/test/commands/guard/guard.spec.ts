import {mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import os, {tmpdir} from "node:os";
import {join} from "node:path";
import {guard} from "../../../src/guard";
import guardSet from "../../../src/commands/guard/set";
import guardShow from "../../../src/commands/guard/show";
import guardRemove from "../../../src/commands/guard/remove";

describe("guard", () => {
  let home: string;
  let project: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    home = realpathSync(mkdtempSync(join(tmpdir(), "spica-cli-guard-home-")));
    project = realpathSync(mkdtempSync(join(tmpdir(), "spica-cli-guard-project-")));
    jest.spyOn(os, "homedir").mockReturnValue(home);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    jest.restoreAllMocks();
    rmSync(home, {recursive: true, force: true});
    rmSync(project, {recursive: true, force: true});
  });

  it("should not restrict when no guard is set", () => {
    expect(guard.load()).toBeUndefined();
    expect(() => guard.assert(originalCwd)).not.toThrow();
  });

  it("should save, load and remove the guard", () => {
    guard.save({path: project, folders: ["bucket"]});
    expect(guard.load()).toEqual({path: project, folders: ["bucket"]});
    expect(guard.remove()).toBe(true);
    expect(guard.load()).toBeUndefined();
    expect(guard.remove()).toBe(false);
  });

  it("should throw when run outside of the guarded directory", () => {
    guard.save({path: project, folders: []});
    process.chdir(home);

    expect(() => guard.assert(home)).toThrow(`Invalid working directory: "${home}"`);
  });

  it("should throw when the dir argument points outside of the guarded directory", () => {
    guard.save({path: project, folders: []});
    process.chdir(project);

    expect(() => guard.assert(home)).toThrow(`Invalid working directory: "${home}"`);
  });

  it("should throw when a required folder is missing", () => {
    mkdirSync(join(project, "bucket"));
    guard.save({path: project, folders: ["bucket", "function"]});
    process.chdir(project);

    expect(() => guard.assert(project)).toThrow("Missing required folder(s): function.");
  });

  it("should pass when run from the guarded directory with all folders present", () => {
    mkdirSync(join(project, "bucket"));
    mkdirSync(join(project, "function"));
    guard.save({path: project, folders: ["bucket", "function"]});
    process.chdir(project);

    expect(() => guard.assert(project)).not.toThrow();
  });

  it("should throw a clear error when the guard file is corrupted", () => {
    writeFileSync(guard.filePath(), "{not json");

    expect(() => guard.load()).toThrow('Run "spica guard remove"');
    expect(() => guard.assert(project)).toThrow('Run "spica guard remove"');
  });

  describe("commands", () => {
    function run(register: (program: any) => any, options: Record<string, unknown> = {}) {
      let action: (params: any) => Promise<void>;
      const command: any = {
        option: () => command,
        action: (fn: typeof action) => ((action = fn), command)
      };
      register({command: () => command});
      return action({options});
    }

    beforeEach(() => {
      jest.spyOn(console, "info").mockImplementation();
      jest.spyOn(console, "warn").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();
      process.exitCode = undefined;
    });

    afterEach(() => {
      process.exitCode = undefined;
    });

    it("set should save the guard with unique trimmed folders", async () => {
      await run(guardSet, {path: project, folders: "bucket, function,bucket"});

      expect(guard.load()).toEqual({path: project, folders: ["bucket", "function"]});
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("bucket, function"));
    });

    it("set should fail when the path is not a directory", async () => {
      await run(guardSet, {path: join(project, "missing")});

      expect(process.exitCode).toBe(1);
      expect(guard.load()).toBeUndefined();
    });

    it("show should print the saved guard", async () => {
      guard.save({path: project, folders: ["bucket"]});
      await run(guardShow);

      expect(console.info).toHaveBeenCalledWith(`Path:    ${project}`);
      expect(console.info).toHaveBeenCalledWith("Folders: bucket");
    });

    it("remove should delete the guard", async () => {
      guard.save({path: project, folders: []});
      await run(guardRemove);

      expect(guard.load()).toBeUndefined();
    });
  });
});
