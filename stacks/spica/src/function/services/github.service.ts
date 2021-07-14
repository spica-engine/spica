import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {map, take, takeUntil, tap} from "rxjs/operators";
import {RepositoryService} from "../interface";
import {v4 as uuidv4} from "uuid";
import {webSocket} from "rxjs/webSocket";
import {Observable} from "rxjs";

export type OAuthUrl = {
  name: "url";
  data: {url: string};
};

export type OAuthToken = {
  name: "token";
  data: {token: string};
};

export type OAuthError = {
  name: "error";
  data: {message: string};
};

export type OAuthResponse = OAuthUrl | OAuthToken | OAuthError;

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

  headers = {};

  startOAuth() {
    const url = "wss://hq.spicaengine.com/api/firehose";
    const subject = webSocket(url);

    return new Observable<OAuthResponse>(subscriber => {
      subject.pipe(take(2)).subscribe((v: OAuthResponse) => subscriber.next(v));
      subject.next({name: "state", data: uuidv4()});

      return () => subject.unsubscribe();
    });
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
