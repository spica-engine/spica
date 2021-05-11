import {ObjectId} from "@spica-server/database";
import {Http, RepoStrategy} from "./interface";

export class Github implements RepoStrategy {
  repoBaseUrl = "https://api.github.com/repos";
  username: string;
  repo: string;
  token: string;

  name: string;
  private activeBranch: {name: string; head: string};

  constructor(private http: Http) {
    this.name = "github";
  }

  async createRepo(name: string, token: string) {
    const {name: repo, default_branch}: any = await this.http.post(
      "https://api.github.com/user/repos",
      {name, auto_init: true},
      {headers: this.headers(token)}
    );

    await this.initializeRepo(repo, token, default_branch);
  }

  async initializeRepo(repo: string, token: string, branch?: string) {
    this.username = await this.extractUsername(token);
    this.repo = repo;
    this.token = token;

    await this.switchBranch(branch);
  }

  // async listRepos(username: string): Promise<any[]> {
  //   const url = `https://api.github.com/users/${username}/repos`;
  //   return this.instance.get(url);
  // }

  async listBranches(repo: string, username: string, token: string): Promise<{name: string}[]> {
    const url = `${this.repoBaseUrl}/${username}/${repo}/branches`;
    return this.http.get<{name: string}[]>(url, {headers: this.headers(token)});
  }

  async switchBranch(branch?: string, commit?: string): Promise<void> {
    if (!branch) {
      const url = `${this.repoBaseUrl}/${this.username}/${this.repo}`;
      const {default_branch}: any = await this.http.get(url, {headers: this.headers(this.token)});
      branch = default_branch;
    }

    if (!commit) {
      const url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/refs/heads/${branch}`;
      const head: any = await this.http.get(url, {headers: this.headers(this.token)});
      commit = head.object.sha;
    }

    this.activeBranch = {name: branch, head: commit};
  }

  async pushCommit(
    files: {name: string; content: string}[],
    repo: string,
    branch: string,
    message: string
  ) {
    if (this.repo != repo) {
      throw new Error(`Please connect the repository ${repo} to the spica before this action.`);
    }

    if (this.activeBranch.name != branch) {
      const existingBranches: any[] = await this.listBranches(repo, this.username, this.token);

      if (existingBranches.findIndex(b => b.name == branch) != -1) {
        throw new Error(`Branch ${branch} already exists.`);
      }
    }

    const tree = [];

    // 1) Upload file to github
    let url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/blobs`;
    for (const file of files) {
      const {sha: uploadedFile}: any = await this.http.post(
        url,
        {content: file.content},
        {headers: this.headers(this.token)}
      );

      tree.push({
        path: file.name,
        mode: "100644",
        type: "blob",
        sha: uploadedFile
      });
    }

    // 2) Upload new tree that includes files
    url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/trees`;
    const {sha: uploadedTree}: any = await this.http.post(
      url,
      {tree},
      {headers: this.headers(this.token)}
    );

    // 3) Upload new commit that includes tree
    url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/commits`;

    const {sha: uploadedCommit}: any = await this.http.post(
      url,
      {
        message,
        tree: uploadedTree,
        parents: [this.activeBranch.head]
      },
      {headers: this.headers(this.token)}
    );

    // 4) Update head as it will show the new commit
    let request;

    // create branch
    if (this.activeBranch.name != branch) {
      url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/refs`;

      request = this.http.post(
        url,
        {ref: `refs/heads/${branch}`, sha: uploadedCommit},
        {headers: this.headers(this.token)}
      );
    } else {
      // update branch
      url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/refs/heads/${branch}`;

      request = this.http.patch(url, {sha: uploadedCommit}, {headers: this.headers(this.token)});
    }

    await request;

    await this.switchBranch(branch, uploadedCommit);
  }

  async pullCommit(
    repo: string,
    branch: string,
    token: string
  ): Promise<{function: string; files: {name: string; content: string}[]}[]> {
    if (this.repo != repo) {
      await this.initializeRepo(repo, token, branch);
    } else {
      await this.switchBranch(branch);
    }

    const url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/commits/${this.activeBranch.head}`;
    const lastCommit: any = await this.http.get(url, {headers: this.headers(this.token)});

    const {tree}: any = await this.http.get(lastCommit.tree.url, {
      headers: this.headers(this.token)
    });

    const changes = [];
    for (const node of tree) {
      const change: any = {};

      if (node.type != "tree" || !ObjectId.isValid(node.path)) {
        continue;
      }

      change.function = node.path;
      change.files = [];

      const {tree: files}: any = await this.http.get(node.url, {headers: this.headers(this.token)});

      for (const file of files) {
        const fileDetails: any = await this.http.get(file.url, {headers: this.headers(this.token)});

        let content = fileDetails.content;
        if (fileDetails.encoding == "base64") {
          content = Buffer.from(content, "base64").toString("ascii");
        }

        change.files.push({name: file.path, content});
      }

      changes.push(change);
    }

    return changes;
  }

  private headers(token: string) {
    return {Authorization: `token ${token}`};
  }

  async extractUsername(token: string) {
    return this.http
      .get("https://api.github.com/user", {
        headers: this.headers(token)
      })
      .then((res: any) => res.login);
  }
}
