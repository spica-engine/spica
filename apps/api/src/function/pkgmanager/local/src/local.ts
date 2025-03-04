import {Package, PackageManager, DelegatePkgManager} from "@spica-server/function/pkgmanager";
import {Observable} from "rxjs";

export class LocalPackageManager extends DelegatePkgManager {
  private LOCAL_PACKAGE_NAME_REGEX = /^[a-fA-F0-9]{24}$/;
  private LOCAL_PACKAGE_VERSION_REGEX = /file:.*([a-fA-F0-9]{24}).*/;

  constructor(pkgManager: PackageManager) {
    super(pkgManager);
  }

  install(cwd: string, _qualifiedNames: string | string[]): Observable<number> {
    let qualifiedNames: string[] = super.normalizePackageNames(_qualifiedNames);
    qualifiedNames = qualifiedNames.map(name => this.transformLocalPackageName(cwd, name));
    return super.install(cwd, qualifiedNames);
  }
  uninstall(cwd: string, name: string): Promise<void> {
    name = this.transformLocalPackageName(cwd, name);
    return super.uninstall(cwd, name);
  }
  ls(cwd: string, includeTypes?: boolean): Promise<Package[]> {
    return super
      .ls(cwd, includeTypes)
      .then(packages => packages.map(pkg => this.maskLocalPackagePath(pkg)));
  }

  private transformLocalPackageName(cwd: string, name: string) {
    if (!this.isLocalPackage(name)) {
      return name;
    }

    const localPackageName = cwd.replace(this.LOCAL_PACKAGE_NAME_REGEX, name);
    return localPackageName;
  }

  private maskLocalPackagePath(pkg: Package) {
    const isLocalPackage = this.LOCAL_PACKAGE_VERSION_REGEX.test(pkg.version);
    if (!isLocalPackage) {
      return pkg;
    }

    pkg.name = this.LOCAL_PACKAGE_VERSION_REGEX.exec(pkg.version)[1];
    pkg.version = "";
    return pkg;
  }

  private isLocalPackage(name: string): boolean {
    return this.LOCAL_PACKAGE_NAME_REGEX.test(name);
  }
}
