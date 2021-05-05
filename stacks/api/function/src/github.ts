import {Injectable} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import axios, {AxiosInstance, AxiosResponse} from "axios";

@Injectable()
export class GithubService {
  instance: AxiosInstance;

  username: string;
  repo: string;
  token: string;

  // Map<branchame,head>
  branches: Map<string, string> = new Map<string, string>();

  constructor() {
    this.instance = axios.create();

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response.data,
      error => Promise.reject(error.response ? error.response.data : error)
    );
  }

  async createRepo(name: string, token: string) {
    const url = "https://api.github.com/user/repos";

    const {name: repo}: any = await this.instance.post(
      url,
      {name, auto_init: true},
      {headers: this.headers(token)}
    );

    await this.initialize(repo, "main", token);
  }

  async initialize(repo: string, branch: string, token: string) {
    const {login: _username}: any = await this.instance.get("https://api.github.com/user", {
      headers: this.headers(token)
    });
    this.username = _username;

    const url = `https://api.github.com/repos/${this.username}/${repo}/git/refs/heads/${branch}`;
    const head: any = await this.instance.get(url, {headers: this.headers(token)});
    this.repo = repo;

    // we will keep this last commit(head) when user started the initialization
    // we will connect the new commit to the last commit(head) for pushing commit.
    // If someone push commit from somewhere else after our initialization and
    // if we try to push our new commit, our new commit will not be connected to the last one(because of the new head changed).
    // Which means it will prevent pushing commit before pulling the last one
    this.branches.set(branch, head.object.sha);
  }

  async pushCommit(
    files: {name: string; content: string}[],
    branch: string,
    message: string,
    token: string
  ) {
    const head = this.branches.get(branch);

    if (!head) {
      throw Error(`Branch '${branch}' does not exist or did not initialized`);
    }

    const tree = [];

    // 1) Upload file to github
    let url = `https://api.github.com/repos/${this.username}/${this.repo}/git/blobs`;
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

    // 2) Upload new tree
    url = `https://api.github.com/repos/${this.username}/${this.repo}/git/trees`;
    const {sha: uploadedTree}: any = await this.instance.post(
      url,
      {tree},
      {headers: this.headers(token)}
    );

    // 3) Upload new commit
    url = `https://api.github.com/repos/${this.username}/${this.repo}/git/commits`;
    const {sha: uploadedCommit}: any = await this.instance.post(
      url,
      {
        message,
        tree: uploadedTree,
        parents: [head]
      },
      {headers: this.headers(token)}
    );

    // 4) Update head as it will show the new commit
    url = `https://api.github.com/repos/${this.username}/${this.repo}/git/refs/heads/${branch}`;
    const newHead: any = await this.instance.patch(
      url,
      {sha: uploadedCommit},
      {headers: this.headers(token)}
    );

    this.branches.set(branch, newHead.object.sha);
  }

  async pullCommit(
    repo: string,
    branch: string,
    token: string
  ): Promise<{function: string; files: {name: string; content: string}[]}[]> {
    await this.initialize(repo, branch, token);

    const head = this.branches.get(branch);

    const url = `https://api.github.com/repos/${this.username}/${this.repo}/git/commits/${head}`;
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
}
