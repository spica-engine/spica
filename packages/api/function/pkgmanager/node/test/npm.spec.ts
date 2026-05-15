import {Npm} from "@spica-server/function-pkgmanager-node";
import fs from "fs";
import path from "path";

describe("npm", () => {
  let npm: Npm;
  let cwd: string;

  beforeEach(() => {
    npm = new Npm();
    cwd = path.join(process.env.TEST_TMPDIR, "__test__");
    fs.mkdirSync(cwd, {recursive: true});
    fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({name: "__testing__"}));
  });

  it("should install 'debug' package", async () => {
    await npm.install(cwd, "debug@4.1.1");
    const packages = await npm.ls(cwd);
    expect(packages).toEqual([
      {
        name: "debug",
        version: "^4.1.1"
      }
    ]);
  });

  it("should install and uninstall 'rxjs' package", async () => {
    await npm.install(cwd, "rxjs@6.0.0");
    let packages = await npm.ls(cwd);
    expect(packages).toEqual([
      {
        name: "rxjs",
        version: "^6.0.0"
      }
    ]);
    await npm.uninstall(cwd, "rxjs");
    packages = await npm.ls(cwd);
    expect(packages).toEqual([]);
  });

  it("it should not fail when uninstalling a package which is not present in", async () => {
    const _catch = jest.fn();
    await npm.uninstall(cwd, "rxjs").catch(_catch);
    expect(_catch).not.toHaveBeenCalled();
  });

  it("it should  fail when installing a package which does not exist", async () => {
    const _catch = jest.fn(() => {});
    await npm.install(cwd, "rxjs@couldnotexist").catch(_catch);
    expect(_catch).toHaveBeenCalled();
    const errorMessage = _catch.mock.calls[0][0 as any];
    expect(errorMessage).toContain("npm error code ETARGET");
    expect(errorMessage).toContain("No matching version found for rxjs@couldnotexist");
    expect(errorMessage).toContain("npm install has failed. code: 1");
  });
});
