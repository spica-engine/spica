import {Observable} from "rxjs";
import {Package} from "../../../../../../libs/interface/function/pkgmanager";

export abstract class PackageManager {
  normalizePackageNames(qualifiedNames: string | string[]): string[] {
    return Array.isArray(qualifiedNames) ? qualifiedNames : [qualifiedNames];
  }

  abstract install(cwd: string, qualifiedNames: string | string[]): Observable<number>;
  abstract uninstall(cwd: string, name: string): Promise<void>;
  abstract ls(cwd: string, includeTypes?: boolean): Promise<Package[]>;
}

export abstract class DelegatePkgManager extends PackageManager {
  constructor(private pkgManager: PackageManager) {
    super();
  }

  normalizePackageNames(qualifiedNames: string | string[]): string[] {
    return super.normalizePackageNames(qualifiedNames);
  }
  install(cwd: string, qualifiedNames: string | string[]): Observable<number> {
    return this.pkgManager.install(cwd, qualifiedNames);
  }
  uninstall(cwd: string, name: string): Promise<void> {
    return this.pkgManager.uninstall(cwd, name);
  }
  ls(cwd: string, includeTypes?: boolean): Promise<Package[]> {
    return this.pkgManager.ls(cwd, includeTypes);
  }
}
