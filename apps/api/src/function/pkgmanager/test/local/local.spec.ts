import {Package, PackageManager} from "@spica-server/function/pkgmanager";
import {Npm} from "@spica-server/function/pkgmanager/node";
import {LocalPackageManager} from "@spica-server/function/pkgmanager/local";
import fs from "fs";
import path from "path";
import {of} from "rxjs";

describe("local package manager", () => {
  describe("unit tests", () => {
    let localPkgManager: LocalPackageManager;
    let mockPackageManager: PackageManager;
    let cwd: string;
    let rootPath: string;

    let fn1 = "67c6ef1bdf7bf58fad82ba4f";
    let fn2 = "67c6f0a2ccfe6f143d4b77c5";

    beforeEach(() => {
      mockPackageManager = {
        install: jest.fn().mockImplementation((...args) => {
          return of(1);
        }),
        ls: jest.fn().mockImplementation((...args) => {
          return [
            {
              name: "mock-fn",
              version: "1",
              types: {}
            }
          ] as Package[];
        }),
        normalizePackageNames: jest.fn().mockImplementation(qualifiedNames => {
          return Array.isArray(qualifiedNames) ? qualifiedNames : [qualifiedNames];
        }),
        uninstall: jest.fn().mockImplementation((...args) => {
          return Promise.resolve();
        })
      };

      localPkgManager = new LocalPackageManager(mockPackageManager);
      rootPath = path.join(process.env.TEST_TMPDIR, "__test__");
      cwd = path.join(rootPath, fn1);
      fs.mkdirSync(cwd, {recursive: true});
      fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({name: "__test__"}));
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("should install non-local package", async () => {
      await localPkgManager.install(cwd, "test@4.1.1").toPromise();
      expect(mockPackageManager.install).toHaveBeenCalledWith(cwd, ["test@4.1.1"]);
    });

    it("should uninstall non-local package", async () => {
      await localPkgManager.uninstall(cwd, "rxjs");
      expect(mockPackageManager.uninstall).toHaveBeenCalledWith(cwd, "rxjs");
    });

    it("should install local package", async () => {
      await localPkgManager.install(cwd, fn2).toPromise();

      const transformedPkgName = localPkgManager["transformLocalPackageName"](cwd, fn2);

      expect(mockPackageManager.install).toHaveBeenCalledWith(cwd, [transformedPkgName]);
      expect(transformedPkgName).toEqual(path.join(rootPath, fn2));
    });

    it("should uninstall local package", async () => {
      await localPkgManager.uninstall(cwd, fn2);

      const transformedPkgName = localPkgManager["transformLocalPackageName"](cwd, fn2);

      expect(mockPackageManager.uninstall).toHaveBeenCalledWith(cwd, transformedPkgName);
      expect(transformedPkgName).toEqual(path.join(rootPath, fn2));
    });
  });

  //   describe("integration tests", () => {
  //     describe("with npm", () => {
  //       let npm: Npm;
  //       let cwd: string;

  //       const fn1Id = "67c6eee118d95f4abe530403";
  //       const fn2Id = "67c6ef1bdf7bf58fad82ba4f";

  //       beforeEach(() => {
  //         localPkgManager = new LocalPackageManager(mockPackageManager);
  //         cwd = path.join(process.env.TEST_TMPDIR, "__test__", fn1Id);
  //         fs.mkdirSync(cwd, {recursive: true});
  //         fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({name: "fn1"}));

  //         const fn2Dir = path.join(process.env.TEST_TMPDIR, "__test__", fn2Id);
  //         fs.mkdirSync(fn2Dir, {recursive: true});
  //         fs.writeFileSync(path.join(fn2Dir, "package.json"), JSON.stringify({name: "fn2"}));
  //       });

  //       it("should install 'debug' package", async () => {
  //         await npm.install(cwd, "debug@4.1.1").toPromise();
  //         const packages = await npm.ls(cwd);
  //         expect(packages).toEqual([
  //           {
  //             name: "debug",
  //             version: "^4.1.1",
  //             types: {}
  //           }
  //         ]);
  //       });

  //       it("should install and uninstall 'rxjs' package", async () => {
  //         await npm.install(cwd, "rxjs@6.0.0").toPromise();
  //         let packages = await npm.ls(cwd);
  //         expect(packages).toEqual([
  //           {
  //             name: "rxjs",
  //             version: "^6.0.0",
  //             types: expect.any(Object)
  //           }
  //         ]);
  //         await npm.uninstall(cwd, "rxjs");
  //         packages = await npm.ls(cwd);
  //         expect(packages).toEqual([]);
  //       });

  //       it("it should not fail when uninstalling a package which is not present in", async () => {
  //         const _catch = jest.fn();
  //         await npm.uninstall(cwd, "rxjs").catch(_catch);
  //         expect(_catch).not.toHaveBeenCalled();
  //       });

  //       it("it should  fail when installing a package which does not exist", async () => {
  //         const _catch = jest.fn(() => {});
  //         await npm.install(cwd, "rxjs@couldnotexist").toPromise().catch(_catch);
  //         expect(_catch).toHaveBeenCalled();
  //         const errorMessage = _catch.mock.calls[0][0 as any];
  //         expect(errorMessage).toContain("npm error code ETARGET");
  //         expect(errorMessage).toContain("No matching version found for rxjs@couldnotexist");
  //         expect(errorMessage).toContain("npm install has failed. code: 1");
  //       });

  //       xit("should report progress", done => {
  //         const progress = [];
  //         npm
  //           .install(cwd, "debug")
  //           .pipe(distinctUntilChanged())
  //           .subscribe({
  //             next: p => progress.push(p),
  //             complete: () => {
  //               // prettier-ignore
  //               expect(progress).toEqual([
  //                       6, 11, 17,  22, 28, 33, 39,
  //                       44, 50, 56,  61, 67, 72, 78,
  //                       83, 89, 94, 100
  //                     ]);
  //               done();
  //             }
  //           });
  //       });
  //     });
  //   });
});
