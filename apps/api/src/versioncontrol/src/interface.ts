export abstract class VersionManager {
  abstract availables(): string[];
  abstract exec(cmd: string, options: {args?: string[]}): Promise<any>;
}
