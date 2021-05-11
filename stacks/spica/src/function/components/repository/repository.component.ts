import {Component, Inject, OnInit} from "@angular/core";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

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

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: any,
    public dialogRef: MatDialogRef<RepositoryComponent>
  ) {
    this.availableRepos = this.data.availableRepos;
    this.selectedRepo = this.data.selectedRepo;
    this.pushStrategy = this.data.pushStrategy;
  }

  filterBranches(repo: string) {
    const index = this.availableRepos.findIndex(r => r.repo == repo);

    if (index == -1) {
      return [];
    }

    return this.availableRepos[index].branches;
  }

  complete(){
    this.dialogRef.close(this.context)
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

        this.pushStrategy.message = "initial commit";
        break;
      case "repo":
        this.pushStrategy.target = "repo";

        this.pushStrategy.branch = "main";
        this.pushStrategy.message = undefined;
        break;
    }
  }


}
