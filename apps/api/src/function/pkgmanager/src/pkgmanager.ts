import {Observable} from "rxjs";

export abstract class PackageManager {
  abstract install(cwd: string, qualifiedNames: string | string[]): Observable<number>;
  abstract uninstall(cwd: string, name: string): Promise<void>;
  abstract ls(cwd: string): Promise<Package[]>;
}

export interface Package {
  name: string;
  version: string;
  types: object;
}
