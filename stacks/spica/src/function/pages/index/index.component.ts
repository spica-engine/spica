import {Component, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {FunctionService} from "../../function.service";
import {Function} from "../../interface";

@Component({
  selector: "function-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  public $data: Observable<Function[]>;
  public displayedColumns = ["_id", "name", "description", "actions"];

  public get token(): string {
    return localStorage.getItem("repo_token");
  }
  public set token(value: string) {
    localStorage.setItem("repo_token", value || "");
  }

  public get selectedRepo(): string {
    return localStorage.getItem("connected_repo_name");
  }
  public set selectedRepo(value: string) {
    localStorage.setItem("connected_repo_name", value || "");
  }

  public get selectedBranch(): string {
    return localStorage.getItem("connected_branch_name");
  }
  public set selectedBranch(value: string) {
    localStorage.setItem("connected_branch_name", value || "");
  }

  //@TODO: use token existance instead of accountConnected value
  repoUsername: string;
  accountConnected: boolean = false;
  repos: string[] = [];
  branches: string[] = [];

  constructor(private functionService: FunctionService) {
    if (!this.token) {
      return;
    }

    this.connectGithub().then(() => {
      if (!this.selectedRepo) {
        return;
      }

      this.onRepoSelection(this.selectedRepo);
    });
  }

  ngOnInit() {
    this.$data = this.functionService.getFunctions();
  }

  delete(id: string): void {
    this.functionService.delete(id).toPromise();
  }

  connectGithub() {
    // remove line below before pushing
    this.token = "";
    localStorage.setItem("repo_token", this.token);

    return this.functionService
      .listRepos(this.token)
      .toPromise()
      .then(res => {
        this.repoUsername = res.username;
        this.repos = res.branches.map(r => r.name);
        this.accountConnected = true;
      })
      .catch(e => {
        this.accountConnected = true;
        console.error(e);
      });
  }

  disConnectGithub() {
    this.token = undefined;

    this.repoUsername = undefined;
    this.accountConnected = false;
    this.repos = [];
    this.branches = [];

    this.selectedRepo = undefined;
    this.selectedBranch = undefined;
  }

  onRepoSelection(repo: string) {
    this.selectedBranch = undefined;

    return this.functionService
      .listBranches(repo, this.repoUsername, this.token)
      .toPromise()
      .then((res: any[]) => {
        this.branches = res.map(r => r.name);
        this.selectedRepo = repo;
      });
  }

  onBranchSelection(branch: string) {
    return this.functionService
      .applyCommit(this.selectedRepo, branch, this.token)
      .toPromise()
      .then(() => (this.selectedBranch = branch));
  }

  pushCommit(message: string, targetBranch?: string) {
    if (!targetBranch) {
      targetBranch = this.selectedBranch;
    }
    return this.functionService
      .pushCommit(this.selectedRepo, targetBranch, message)
      .toPromise()
      .then(() => {
        if (targetBranch != this.selectedBranch) {
          return this.onRepoSelection(this.selectedRepo).then(
            () => (this.selectedBranch = targetBranch)
          );
        }
      });
  }

  createRepo(repo: string) {
    return this.functionService
      .createRepo(repo, this.token)
      .toPromise()
      .then(() => this.onRepoSelection(repo).then(() => (this.selectedBranch = "main")));
  }
}
