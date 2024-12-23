import {Npm} from "@spica-server/function/pkgmanager/node";
import * as fs from "fs";
import * as path from "path";
import {distinctUntilChanged} from "rxjs/operators";

jest.setTimeout(120000);

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
    await npm.install(cwd, "debug@4.1.1").toPromise();
    const packages = await npm.ls(cwd);
    expect(packages).toEqual([
      {
        name: "debug",
        version: "^4.1.1",
        types: {}
      }
    ]);
  });

  it("should install and uninstall 'rxjs' package", async () => {
    await npm.install(cwd, "rxjs@6.0.0").toPromise();
    let packages = await npm.ls(cwd);
    expect(packages).toEqual([
      {
        name: "rxjs",
        version: "^6.0.0",
        types: expect.any(Object)
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
    await npm
      .install(cwd, "rxjs@couldnotexist")
      .toPromise()
      .catch(_catch);
    expect(_catch).toHaveBeenCalled();
    const errorMessage = _catch.mock.calls[0][0 as any];
    expect(errorMessage).toContain("npm error code ETARGET");
    expect(errorMessage).toContain("No matching version found for rxjs@couldnotexist");
    expect(errorMessage).toContain("npm install has failed. code: 1");
  });

  xit("should report progress", done => {
    const progress = [];
    npm
      .install(cwd, "debug")
      .pipe(distinctUntilChanged())
      .subscribe({
        next: p => progress.push(p),
        complete: () => {
          // prettier-ignore
          expect(progress).toEqual([
            6, 11, 17,  22, 28, 33, 39,
            44, 50, 56,  61, 67, 72, 78,
            83, 89, 94, 100
          ]);
          done();
        }
      });
  });
});
