import path from "path";
import {Observable, throwError} from "rxjs";
import {
  Package,
  PackageManager,
  DelegatePkgManager
} from "@spica-server/interface-function-pkgmanager";

export class LocalPackageManager extends DelegatePkgManager {
  private readonly LOCAL_PACKAGE_PREFIX = "@spica-fn/";
  private readonly LOCAL_PACKAGE_REGEX = /^@spica-fn\/[^@]+$/;

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
  ls(cwd: string): Promise<Package[]> {
    return super.ls(cwd);
  }

  private transformLocalPackageName(cwd: string, name: string) {
    if (!this.isLocalPackage(name)) {
      return name;
    }
    const folderName = name.slice(this.LOCAL_PACKAGE_PREFIX.length);
    const folderPath = path.join(path.dirname(cwd), folderName);

    const areTheySame = folderPath === cwd;
    if (areTheySame) {
      throw Error("Cannot install package into itself.");
    }

    const relativePath = path.relative(cwd, folderPath);
    return `${name}@file:${relativePath}`;
  }

  private isLocalPackage(name: string): boolean {
    return this.LOCAL_PACKAGE_REGEX.test(name);
  }
}
