import {Component, Inject, OnInit} from "@angular/core";
import {MAT_DIALOG_DATA, MatDialogRef, MatDialog} from "@angular/material/dialog";

@Component({
  selector: "repository",
  templateUrl: "./repository.component.html",
  styleUrls: ["./repository.component.scss"]
})
export class RepositoryComponent {
  availableRepos: {repo: string; branches: string[]}[] = [];
  selectedRepo: {repo: string; branch: string} = {repo: undefined, branch: undefined};

  context: "pull" | "push" = "pull";

  pushStrategy: {
    target: "repo" | "branch" | "commit";
    repo: string;
    branch?: string;
    message?: string;
  } = {target: undefined, repo: undefined};

  user: {
    username: string;
    avatar_url: string;
  };

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: any,
    public dialogRef: MatDialogRef<RepositoryComponent>,
    public dialog: MatDialog
  ) {
    this.availableRepos = this.data.availableRepos;
    this.selectedRepo = this.data.selectedRepo;
    this.pushStrategy = this.data.pushStrategy;
    this.user = this.data.user;
  }

  filterBranches(repo: string) {
    const index = this.availableRepos.findIndex(r => r.repo == repo);

    if (index == -1) {
      return [];
    }

    return this.availableRepos[index].branches;
  }

  complete() {
    this.dialogRef.close(this.context);
  }

  switchToPush(strategy: "repo" | "branch" | "commit") {
    this.context = "push";
    switch (strategy) {
      case "commit":
        this.pushStrategy.target = "commit";
        this.pushStrategy.repo = this.selectedRepo.repo;
        this.pushStrategy.branch = this.selectedRepo.branch;
        break;
      case "branch":
        this.pushStrategy.target = "branch";
        this.pushStrategy.repo = this.selectedRepo.repo;
        break;
      case "repo":
        this.pushStrategy.target = "repo";

        this.pushStrategy.branch = "main";
        this.pushStrategy.message = undefined;
        break;
    }
  }

  clearPushStrategy() {
    this.pushStrategy.target = undefined;
    this.pushStrategy.repo = undefined;
    this.pushStrategy.branch = undefined;
    this.pushStrategy.message = undefined;
    console.log(this.pushStrategy);
  }
}
