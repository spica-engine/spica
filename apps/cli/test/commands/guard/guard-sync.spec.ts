import {mkdtempSync, realpathSync, rmSync} from "node:fs";
import os, {tmpdir} from "node:os";
import {join} from "node:path";
import {guard} from "../../../src/guard";
import {httpService} from "../../../src/http";
import plan from "../../../src/commands/sync/plan";
import apply from "../../../src/commands/sync/apply";

function captureAction(register: (program: any) => any) {
  let action: (params: any) => Promise<void>;
  const command: any = new Proxy(
    {},
    {
      get: (_, prop) =>
        prop === "action" ? (fn: typeof action) => ((action = fn), command) : () => command
    }
  );
  register({command: () => command});
  return action;
}

describe("guard on plan and apply", () => {
  let home: string;
  let project: string;
  let elsewhere: string;
  let originalCwd: string;
  let createClient: jest.SpyInstance;

  beforeEach(() => {
    originalCwd = process.cwd();
    home = realpathSync(mkdtempSync(join(tmpdir(), "spica-cli-guard-home-")));
    project = realpathSync(mkdtempSync(join(tmpdir(), "spica-cli-guard-project-")));
    elsewhere = realpathSync(mkdtempSync(join(tmpdir(), "spica-cli-guard-other-")));
    jest.spyOn(os, "homedir").mockReturnValue(home);
    jest.spyOn(console, "error").mockImplementation();
    createClient = jest.spyOn(httpService, "createFromCurrentCtx");
    guard.save({path: project, folders: []});
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = undefined;
    jest.restoreAllMocks();
    for (const dir of [home, project, elsewhere]) {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it("plan should exit with 1 before contacting the API when run from another directory", async () => {
    process.chdir(elsewhere);

    await captureAction(plan)({args: {}, options: {}});

    expect(process.exitCode).toBe(1);
    expect(createClient).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid working directory")
    );
  });

  it("apply should exit with 1 before contacting the API when run from another directory", async () => {
    process.chdir(elsewhere);

    await captureAction(apply)({args: {}, options: {autoApprove: true}});

    expect(process.exitCode).toBe(1);
    expect(createClient).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid working directory")
    );
  });

  it("apply should refuse a dir argument outside of the guarded directory", async () => {
    process.chdir(project);

    await captureAction(apply)({args: {dir: elsewhere}, options: {autoApprove: true}});

    expect(process.exitCode).toBe(1);
    expect(createClient).not.toHaveBeenCalled();
  });
});
