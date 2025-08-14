import {Observable, throwError} from "rxjs";
import {
  Package,
  PackageManager,
  DelegatePkgManager
} from "@spica-server/interface/function/pkgmanager";

export class LocalPackageManager extends DelegatePkgManager {
  private LOCAL_PACKAGE_NAME_REGEX = /^[a-fA-F0-9]{24}$/;
  private LOCAL_PACKAGE_VERSION_REGEX = /file:.*([a-fA-F0-9]{24}).*/;
  private LOCAL_PACKAGE_NAME_REGEX_REPLACER = /([a-fA-F0-9]{24}$)/;

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
    if (!this.isLocalPackage(name)) {
      return name;
    }
    const localPackageName = cwd.replace(this.LOCAL_PACKAGE_NAME_REGEX_REPLACER, name);

    const areTheySame = localPackageName == cwd;
    if (areTheySame) {
      throw Error("Cannot install package into itself.");
    }

    return localPackageName;
  }

  private maskLocalPackage(pkg: Package) {
    const isLocalPackage = this.LOCAL_PACKAGE_VERSION_REGEX.test(pkg.version);
    if (!isLocalPackage) {
      return pkg;
    }

    pkg.version = this.LOCAL_PACKAGE_VERSION_REGEX.exec(pkg.version)[1];
    return pkg;
  }

  private isLocalPackage(name: string): boolean {
    return this.LOCAL_PACKAGE_NAME_REGEX.test(name);
  }
}
