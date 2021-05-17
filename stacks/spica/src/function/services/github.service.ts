import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {delay, filter, map, retryWhen, take, tap} from "rxjs/operators";
import {RepositoryService} from "../interface";
import {v4 as uuidv4} from "uuid";

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

  state: string;

  headers = {};

  startPolling() {
    const url = `https://hq.spicaengine.com/api/fn-execute/github-token?state=${this.state}`;
    return this.http.get<{token: string}>(url).pipe(
      retryWhen(errors =>
        errors.pipe(
          delay(10000),
          take(6)
        )
      ),
      map(res => res.token)
    );
  }

  getLoginPage() {
    this.state = uuidv4();
    const url = `https://hq.spicaengine.com/api/fn-execute/github-oauth?state=${this.state}`;
    return this.http.get<{url: string}>(url).pipe(map(res => res.url));
  }

  async initialize(token?: string) {
    this.token = token;

    this.headers = {Authorization: `token ${token}`};

    const {login, avatar_url} = await this.getUser().toPromise();

    this.username = login;

    return {
      username: this.username,
      avatar_url
    };
  }

  getUser() {
    const url = "https://api.github.com/user";
    return this.http.get<{login: string; avatar_url: string}>(url, {headers: this.headers});
  }

  listRepos() {
    const url = `https://api.github.com/users/${this.username}/repos`;

    return this.http.get<{name: string}[]>(url, {
      headers: this.headers
    });
  }

  listBranches(repo: string) {
    const url = `https://api.github.com/repos/${this.username}/${repo}/branches`;

    return this.http.get<{name: string}[]>(url, {headers: this.headers});
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
