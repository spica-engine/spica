import {Component, Inject, OnInit} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {Services} from "@spica-client/passport/interfaces/service";
import {NgModel} from "@angular/forms";
import {DisplayedStatement, DisplayedAction} from "@spica-client/passport/interfaces/statement";

@Component({
  selector: "policy-resource-add",
  templateUrl: "./policy-resource-add.component.html",
  styleUrls: ["./policy-resource-add.component.scss"]
})
export class PolicyResourceAddComponent implements OnInit {
  resourceParts: string[] = [];

  constructor(
    public dialogRef: MatDialogRef<PolicyResourceAddComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {services: Services; statement: DisplayedStatement; currentAction: DisplayedAction}
  ) {}

  ngOnInit(): void {
    this.resourceParts = this.data.services[this.data.statement.module][
      this.data.currentAction.name
    ];
  }

  isValidResource(resource: string, partsLength: number) {
    return new RegExp(this.resourcePattern(partsLength)).test(resource);
  }

  resourcePattern(partsLength?: number) {
    const array = partsLength ? new Array(partsLength) : this.resourceParts;
    console.log(array.map(() => "[a-zA-Z0-9\\*]+").join("\\/"));
    return array.map(() => "[a-zA-Z0-9\\*]+").join("\\/");
  }

  // if exclude has length, include must end with *
  // resourcePatternEndWithAsteriks() {
  //   let untilLastSegment = this.resourceParts
  //     .slice(0, this.resourceParts.length - 1)
  //     .map(() => "[a-zA-Z0-9\\*]")
  //     .join("\\/");
  //   return untilLastSegment + "[\\*]$";
  // }

  addInclude() {
    this.data.currentAction.resource.exclude = [];
    this.data.currentAction.resource.include.push("");
  }

  addExclude() {
    let included = this.data.currentAction.resource.include[0];

    if (!included) {
      included = this.resourceParts.map(() => "*").join("/");
    }

    this.data.currentAction.resource.include = [included];
    this.data.currentAction.resource.exclude.push("");
  }

  removeIncluded(resourceIndex: number) {
    this.data.currentAction.resource.include.splice(resourceIndex, 1);
  }

  removeExcluded(resourceIndex: number) {
    this.data.currentAction.resource.exclude.splice(resourceIndex, 1);
  }

  copyResources() {
    for (const action of this.data.statement.actions) {
      if (action.name == this.data.currentAction.name) {
        continue;
      }

      const resourceParts = this.data.services[this.data.statement.module][action.name];

      const includesValid = this.data.currentAction.resource.include.every(resource =>
        this.isValidResource(resource, resourceParts.length)
      );

      const excludesValid = this.data.currentAction.resource.exclude.every(resource =>
        this.isValidResource(resource, resourceParts.length)
      );

      if (!includesValid || !excludesValid) {
        continue;
      }

      action.resource = this.deepCopy(this.data.currentAction.resource);
    }
  }

  deepCopy(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }

  trackByFn(index: number) {
    return index;
  }

  trackByFn2(index: number) {
    return index;
  }
}
