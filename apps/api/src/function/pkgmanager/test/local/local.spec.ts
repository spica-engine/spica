import {PackageManager} from "@spica-server/function/pkgmanager";
import {Npm} from "@spica-server/function/pkgmanager/node";
import {LocalPackageManager} from "@spica-server/function/pkgmanager/local";
import fs from "fs";
import path from "path";
import {of} from "rxjs";
import {Package} from "@spica-server/interface/function/pkgmanager";

describe("local package manager", () => {
  let fn1Id = "67c6ef1bdf7bf58fad82ba4f";
  let fn2Id = "67c6f0a2ccfe6f143d4b77c5";

  describe("unit tests", () => {
    let localPkgManager: LocalPackageManager;
    let mockPackageManager: PackageManager;
    let cwd: string;
    let rootPath: string;

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
      cwd = path.join(rootPath, fn1Id);
      fs.mkdirSync(cwd, {recursive: true});
      fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({name: "__test__"}));
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("should transform local package names, skip others", async () => {
      await localPkgManager.install(cwd, ["test@4.1.1", fn2Id]).toPromise();
      const transformedPkgName = localPkgManager["transformLocalPackageName"](cwd, fn2Id);
      expect(mockPackageManager.install).toHaveBeenCalledWith(cwd, [
        "test@4.1.1",
        transformedPkgName
      ]);
      expect(transformedPkgName).toEqual(path.join(rootPath, fn2Id));
    });

    it("should uninstall local packages", async () => {
      await localPkgManager.uninstall(cwd, "fn2");
      expect(mockPackageManager.uninstall).toHaveBeenCalledWith(cwd, "fn2");
    });

    it("should uninstall other packages", async () => {
      await localPkgManager.uninstall(cwd, "rxjs");
      expect(mockPackageManager.uninstall).toHaveBeenCalledWith(cwd, "rxjs");
    });

    it("should prevent installing itself as package", async () => {
      let errMsg;
      try {
        await localPkgManager.install(cwd, fn1Id).toPromise();
      } catch (error) {
        errMsg = error.message;
      }
      expect(errMsg).toEqual("Cannot install package into itself.");
    });
  });

  describe("integration tests", () => {
    describe("with npm", () => {
      let localPackageManager: LocalPackageManager;
      let cwd: string;

      beforeEach(() => {
        localPackageManager = new LocalPackageManager(new Npm());
        cwd = path.join(process.env.TEST_TMPDIR, "__test__", fn1Id);
        fs.mkdirSync(cwd, {recursive: true});
        fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({name: "fn1"}));

        const fn2Dir = path.join(process.env.TEST_TMPDIR, "__test__", fn2Id);
        fs.mkdirSync(fn2Dir, {recursive: true});
        fs.writeFileSync(path.join(fn2Dir, "package.json"), JSON.stringify({name: "fn2"}));
      });

      it("should install, uninstall packages", async () => {
        await localPackageManager.install(cwd, ["debug@4.1.1", fn2Id]).toPromise();
        let packages = await localPackageManager.ls(cwd);
        expect(packages).toEqual([
          {
            name: "debug",
            version: "^4.1.1",
            types: {}
          },
          {
            name: "fn2",
            version: fn2Id,
            types: {}
          }
        ]);

        await localPackageManager.uninstall(cwd, "fn2");
        packages = await localPackageManager.ls(cwd);
        expect(packages).toEqual([
          {
            name: "debug",
            version: "^4.1.1",
            types: {}
          }
        ]);

        await localPackageManager.uninstall(cwd, "debug");
        packages = await localPackageManager.ls(cwd);
        expect(packages).toEqual([]);
      });
    });
  });
});
