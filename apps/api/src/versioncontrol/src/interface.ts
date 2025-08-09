export abstract class VersionManager {
  abstract availables(): string[];
  abstract qwe(cmd: string, options: {args?: string[]}): Promise<any>;
}
