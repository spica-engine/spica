import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {map} from "rxjs/operators";
import {RepositoryService} from "../interface";

@Injectable({providedIn: "root"})
export class GithubService implements RepositoryService {
  constructor(private http: HttpClient) {}

  name: string = "github";

  public get token(): string {
    return localStorage.getItem("github_token");
  }
  public set token(value: string) {
    localStorage.setItem("github_token", value || "");
  }

  public get username(): string {
    return localStorage.getItem("github_username");
  }

  public set username(value: string) {
    localStorage.setItem("github_username", value || "");
  }

  public get selectedRepoBranch() {
    const cachedSelected = localStorage.getItem("github_repo_branch");

    const def = {repo: undefined, branch: undefined};
    try {
      return JSON.parse(cachedSelected) || def;
    } catch (error) {
      console.log(error);
      return def;
    }
  }
  public set selectedRepoBranch(value: {repo: string; branch: string}) {
    localStorage.setItem("github_repo_branch", JSON.stringify(value));
  }

  async initialize(token?: string) {
    this.token = token;

    this.username = await this.getUserName().toPromise();

    return this.username;
  }

  getUserName() {
    const url = "https://api.github.com/user";
    const headers = {Authorization: `token ${this.token}`};
    return this.http.get<{login: string}>(url, {headers}).pipe(map(res => res.login));
  }

  listRepos() {
    const headers = {Authorization: `token ${this.token}`};

    return this.http.get<{name: string}[]>(`https://api.github.com/users/${this.username}/repos`, {
      headers
    });
  }

  listBranches(repo: string) {
    const url = `https://api.github.com/repos/${this.username}/${repo}/branches`;
    const headers = {Authorization: `token ${this.token}`};

    return this.http.get<{name: string}[]>(url, {headers});
  }

  pullCommit(repo: string, branch: string, commit: string = "latest") {
    const url = `api:/function/integrations/github/repos/${repo}/branches/${branch}/commits/${commit}`;
    return this.http.put(url, {token: this.token});
  }

  pushCommit(repo: string, branch: string, message: string) {
    const url = `api:/function/integrations/github/repos/${repo}/branches/${branch}/commits`;
    return this.http.post(url, {message});
  }

  createRepo(repo: string) {
    const url = "api:/function/integrations/github/repos";
    return this.http.post(url, {repo, token: this.token});
  }

  listCommits(repo: string, branch: string) {}
}
