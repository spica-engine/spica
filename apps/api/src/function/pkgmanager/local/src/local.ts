import fs from "fs";
import path from "path";
import {Observable, throwError} from "rxjs";
import {
  Package,
  PackageManager,
  DelegatePkgManager
} from "@spica-server/interface/function/pkgmanager";

export class LocalPackageManager extends DelegatePkgManager {
  constructor(pkgManager: PackageManager) {
    super(pkgManager);
  }

  install(cwd: string, _qualifiedNames: string | string[]): Observable<number> {
    let qualifiedNames: string[] = super.normalizePackageNames(_qualifiedNames);
    try {
      qualifiedNames = qualifiedNames.map(name => this.transformLocalPackageName(cwd, name));
    } catch (error) {
      return throwError(() => error);
    }
    return super.install(cwd, qualifiedNames);
  }
  uninstall(cwd: string, name: string): Promise<void> {
    return super.uninstall(cwd, name);
  }
  ls(cwd: string, includeTypes?: boolean): Promise<Package[]> {
    return super
      .ls(cwd, includeTypes)
      .then(packages => packages.map(pkg => this.maskLocalPackage(pkg)));
  }

  private transformLocalPackageName(cwd: string, name: string) {
    if (!this.isLocalPackage(cwd, name)) {
      return name;
    }
    const localPackageName = path.join(path.dirname(cwd), name);

    const areTheySame = localPackageName == cwd;
    if (areTheySame) {
      throw Error("Cannot install package into itself.");
    }

    return localPackageName;
  }

  private maskLocalPackage(pkg: Package) {
    if (!pkg.version.startsWith("file:")) {
      return pkg;
    }

    pkg.version = path.basename(pkg.version);
    return pkg;
  }

  private isLocalPackage(cwd: string, name: string): boolean {
    const parentDir = path.dirname(cwd);
    const siblings = fs.readdirSync(parentDir, {withFileTypes: true});
    return siblings.some(entry => entry.isDirectory() && entry.name === name);
  }
}
