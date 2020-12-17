import {discovery, pkgmanager} from "@spica-server/function/runtime";
import * as fs from "fs";
import * as path from "path";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

describe("npm", () => {
  let cwd: string;
  let options: pkgmanager.Options;

  beforeEach(() => {
    cwd = path.join(process.env.TEST_TMPDIR, fs.mkdtempSync("__test__"));
    fs.mkdirSync(cwd, {recursive: true});
    fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({name: "__testing__"}));
    options = {
      for: cwd,
      runtime: {
        name: "node",
        version: "12.19.0"
      }
    };
    discovery.root = "./stacks/api/function/runtimes";
  });

  it("should install 'debug' package", async () => {
    await pkgmanager.install(options, "debug@4.1.1");
    const packages = await pkgmanager.ls(options);
    expect(packages).toEqual([
      {
        name: "debug",
        version: "^4.1.1"
      }
    ]);
  });

  it("should install and uninstall 'rxjs' package", async () => {
    await pkgmanager.install(options, "rxjs@6.0.0");
    let packages = await pkgmanager.ls(options);
    expect(packages).toEqual([
      {
        name: "rxjs",
        version: "^6.0.0"
      }
    ]);
    await pkgmanager.uninstall(options, "rxjs");
    packages = await pkgmanager.ls(options);
    expect(packages).toEqual([]);
  });

  it("it should not fail when uninstalling a package which is not present in", async () => {
    const _catch = jasmine.createSpy();
    await pkgmanager.uninstall(options, "rxjs").catch(_catch);
    expect(_catch).not.toHaveBeenCalled();
  });

  it("it should  fail when installing a package which does not exist", async () => {
    const _catch = jasmine.createSpy().and.callFake(() => {});
    await pkgmanager.install(options, "rxjs@couldnotexist").catch(_catch);
    expect(_catch).toHaveBeenCalled();
    const errorMessage = _catch.calls.argsFor(0)[0];
    expect(errorMessage).toContain("npm ERR! code ETARGET");
    expect(errorMessage).toContain("No matching version found for rxjs@couldnotexist");
  });
});
