export abstract class RepoStrategy {
  name: string;

  constructor() {}

  abstract createRepo(name: string, token: string): Promise<any>;

  abstract initializeRepo(repo: string, token: string, branch?: string): Promise<any>;

  abstract switchBranch(branch: string): Promise<any>;

  abstract listBranches(repo: string, username: string): Promise<any>;

  abstract pushCommit(
    files: {name: string; content: string}[],
    repo: string,
    branch: string,
    message: string
  ): Promise<any>;

  abstract pullCommit(
    repo: string,
    branch: string,
    token: string
  ): Promise<{function: string; files: {name: string; content: string}[]}[]>;
}

export class RepoStrategies {
  constructor(private strategies: RepoStrategy[]) {}
  find(strategy: string) {
    let index = this.strategies.findIndex(s => s.name == strategy);
    if (index == -1) {
      throw new Error(`Strategy ${strategy} does not provided.`);
    }

    return this.strategies[index];
  }
}

export abstract class Http {
  abstract get<T>(url: string, options?: any): Promise<T>;
  abstract post<T>(url: string, body: any, options?: any): Promise<T>;
  abstract put<T>(url: string, body: any, options?: any): Promise<T>;
  abstract patch<T>(url: string, body: any, options?: any): Promise<T>;
  abstract delete(url: string, options?: any);
}
