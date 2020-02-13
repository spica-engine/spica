export abstract class PackageManager {
  abstract install(cwd: string, qualifiedName: string): Promise<void>;
  abstract uninstall(cwd: string, name: string): Promise<void>;
  abstract ls(cwd: string): Promise<Package[]>;
}

export interface Package {
  name: string;
  version: string;
}
