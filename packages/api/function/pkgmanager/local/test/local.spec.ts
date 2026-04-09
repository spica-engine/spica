import {Npm} from "@spica-server/function-pkgmanager-node";
import {LocalPackageManager} from "@spica-server/function-pkgmanager-local";
import fs from "fs";
import path from "path";
import {of} from "rxjs";
import {Package, PackageManager} from "@spica-server/interface-function-pkgmanager";

describe("local package manager", () => {
  let fn1Name = "my-first-function";
  let fn2Name = "my-second-function";

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
      cwd = path.join(rootPath, fn1Name);
      fs.mkdirSync(cwd, {recursive: true});
      fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({name: "__test__"}));
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("should transform local package names, skip others", async () => {
      const prefixedFn2 = `@spica-fn/${fn2Name}`;
      await localPkgManager.install(cwd, ["test@4.1.1", prefixedFn2]).toPromise();
      const transformedPkgName = localPkgManager["transformLocalPackageName"](cwd, prefixedFn2);
      expect(mockPackageManager.install).toHaveBeenCalledWith(cwd, [
        "test@4.1.1",
        transformedPkgName
      ]);
      expect(transformedPkgName).toEqual(`@spica-fn/${fn2Name}@file:../${fn2Name}`);
    });

    it("should uninstall local packages", async () => {
      await localPkgManager.uninstall(cwd, `@spica-fn/${fn2Name}`);
      expect(mockPackageManager.uninstall).toHaveBeenCalledWith(cwd, `@spica-fn/${fn2Name}`);
    });

    it("should uninstall other packages", async () => {
      await localPkgManager.uninstall(cwd, "rxjs");
      expect(mockPackageManager.uninstall).toHaveBeenCalledWith(cwd, "rxjs");
    });

    it("should prevent installing itself as package", async () => {
      let errMsg;
      try {
        await localPkgManager.install(cwd, `@spica-fn/${fn1Name}`).toPromise();
      } catch (error) {
        errMsg = error.message;
      }
      expect(errMsg).toEqual("Cannot install package into itself.");
    });

    it("should not transform local package names that already have a version specifier", async () => {
      const pkgWithSemver = `@spica-fn/${fn2Name}@1.0.0`;
      const pkgWithFile = `@spica-fn/${fn2Name}@file:../custom-path`;
      await localPkgManager.install(cwd, [pkgWithSemver, pkgWithFile]).toPromise();
      expect(mockPackageManager.install).toHaveBeenCalledWith(cwd, [pkgWithSemver, pkgWithFile]);
    });
  });

  describe("integration tests", () => {
    describe("with npm", () => {
      let localPackageManager: LocalPackageManager;
      let cwd: string;

      beforeEach(() => {
        localPackageManager = new LocalPackageManager(new Npm());
        cwd = path.join(process.env.TEST_TMPDIR, "__test__", fn1Name);
        fs.mkdirSync(cwd, {recursive: true});
        fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({name: "fn1"}));

        const fn2Dir = path.join(process.env.TEST_TMPDIR, "__test__", fn2Name);
        fs.mkdirSync(fn2Dir, {recursive: true});
        fs.writeFileSync(
          path.join(fn2Dir, "package.json"),
          JSON.stringify({name: `@spica-fn/${fn2Name}`})
        );
      });

      it("should not transform local package names that already have an explicit file specifier", async () => {
        const explicitFilePkg = `@spica-fn/${fn2Name}@file:../${fn2Name}`;
        await localPackageManager.install(cwd, [explicitFilePkg]).toPromise();
        const packages = await localPackageManager.ls(cwd);
        expect(packages).toEqual([
          {
            name: `@spica-fn/${fn2Name}`,
            version: `file:../${fn2Name}`,
            types: {}
          }
        ]);
      });

      it("should install, uninstall packages", async () => {
        await localPackageManager.install(cwd, ["debug@4.1.1", `@spica-fn/${fn2Name}`]).toPromise();
        let packages = await localPackageManager.ls(cwd);
        expect(packages).toEqual([
          {
            name: `@spica-fn/${fn2Name}`,
            version: "file:../my-second-function",
            types: {}
          },
          {
            name: "debug",
            version: "^4.1.1",
            types: {}
          }
        ]);

        await localPackageManager.uninstall(cwd, `@spica-fn/${fn2Name}`);
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
