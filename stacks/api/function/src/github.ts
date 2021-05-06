import {Injectable} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import axios, {AxiosInstance, AxiosResponse} from "axios";

@Injectable()
export class GithubService {
  repoBaseUrl = "https://api.github.com/repos";
  instance: AxiosInstance;

  username: string;
  repo: string;
  token: string;

  private activeBranch: {name: string; head: string};

  constructor() {
    this.instance = axios.create();

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response.data,
      error => Promise.reject(error.response ? error.response.data : error)
    );
  }

  async createRepo(name: string, token: string) {
    const {name: repo}: any = await this.instance.post(
      "https://api.github.com/user/repos",
      {name, auto_init: true},
      {headers: this.headers(token)}
    );

    await this.initializeRepo(repo, token, "main");
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

  async listBranches(repo: string, username: string): Promise<{name: string}[]> {
    const url = `${this.repoBaseUrl}/${username}/${repo}/branches`;
    return this.instance.get(url);
  }

  async switchBranch(branch?: string) {
    if (!branch) {
      const url = `${this.repoBaseUrl}/${this.username}/${this.repo}`;
      const {default_branch}: any = await this.instance.get(url);
      branch = default_branch;
    }

    const url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/refs/heads/${branch}`;
    const head: any = await this.instance.get(url, {headers: this.headers(this.token)});

    this.activeBranch = {name: branch, head: head.object.sha};
  }

  async pushCommit(
    files: {name: string; content: string}[],
    repo: string,
    branch: string,
    message: string,
    token: string
  ) {
    if (this.repo != repo) {
      throw new Error(`Please connect the repository ${repo} to the spica before this action.`);
    }

    const existingBranches: any[] = await this.listBranches(repo, this.username);

    if (existingBranches.findIndex(b => b.name == branch) != -1) {
      throw new Error(
        `The branch named ${branch} already exists. Please provide a non-exist branch name or switch to the branch named ${branch}. Keep in mind that your current changes will be lost if you switch to the branch named ${branch}`
      );
    }

    const tree = [];

    // 1) Upload file to github
    let url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/blobs`;
    for (const file of files) {
      const {sha: uploadedFile}: any = await this.instance.post(
        url,
        {content: file.content},
        {headers: this.headers(token)}
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
    const {sha: uploadedTree}: any = await this.instance.post(
      url,
      {tree},
      {headers: this.headers(token)}
    );

    // 3) Upload new commit that includes tree
    url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/commits`;

    const {sha: uploadedCommit}: any = await this.instance.post(
      url,
      {
        message,
        tree: uploadedTree,
        parents: [this.activeBranch.head]
      },
      {headers: this.headers(token)}
    );

    // 4) Update head as it will show the new commit
    let request;

    // create branch
    if (this.activeBranch.name != branch) {
      url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/refs`;

      request = this.instance.post(
        url,
        {ref: `refs/heads/${branch}`, sha: uploadedCommit},
        {headers: this.headers(token)}
      );
    } else {
      // update branch
      url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/refs/heads/${branch}`;

      request = this.instance.patch(url, {sha: uploadedCommit}, {headers: this.headers(token)});
    }

    await request;
  }

  async pullLatestCommit(
    repo: string,
    branch: string,
    token: string
  ): Promise<{function: string; files: {name: string; content: string}[]}[]> {
    if (this.repo != repo) {
      await this.initializeRepo(repo, token, branch);
    } else if (this.activeBranch.name != branch) {
      await this.switchBranch(branch);
    }

    const url = `${this.repoBaseUrl}/${this.username}/${this.repo}/git/commits/${this.activeBranch.head}`;
    const lastCommit: any = await this.instance.get(url);

    const {tree}: any = await this.instance.get(lastCommit.tree.url);

    const changes = [];
    for (const node of tree) {
      const change: any = {};

      if (node.type != "tree" || !ObjectId.isValid(node.path)) {
        return;
      }

      change.function = node.path;
      change.files = [];

      const {tree: files}: any = await this.instance.get(node.url);

      for (const file of files) {
        const fileDetails: any = await this.instance.get(file.url);

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
    return this.instance
      .get("https://api.github.com/user", {
        headers: this.headers(token)
      })
      .then((res: any) => res.login);
  }
}
