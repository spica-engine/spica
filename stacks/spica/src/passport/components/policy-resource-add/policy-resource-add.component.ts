import {Component, Inject, OnInit} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {Services} from "@spica-client/passport/interfaces/service";

@Component({
  selector: "policy-resource-add",
  templateUrl: "./policy-resource-add.component.html",
  styleUrls: ["./policy-resource-add.component.scss"]
})
export class PolicyResourceAddComponent implements OnInit {
  services: Services;

  constructor(
    public dialogRef: MatDialogRef<PolicyResourceAddComponent>,
    @Inject(MAT_DIALOG_DATA) public data
  ) {}

  ngOnInit(): void {
    this.services = this.data.services;
  }

  getAction(action: string) {
    const actionIndex = this.data.statement["actions"].findIndex(
      actionInStatement => actionInStatement.action == action
    );
    return actionIndex >= 0 ? this.data.statement["actions"][actionIndex] : false;
  }

  getResourceSelection(action) {
    if (action && action.resource instanceof Array) {
      return "include";
    } else if (action && action.resource instanceof Object) {
      return "exclude";
    } else {
      return undefined;
    }
  }

  acceptsResource(action) {
    return (
      this.services[this.data.statement.module] &&
      this.services[this.data.statement.module][action] &&
      this.services[this.data.statement.module][action].length > 0
    );
  }

  addInclude(resource: string, action) {
    if (resource == "") {
      resource = this.trimResource("*/*", action.action);
    }
    (action.resource as string[]).push(resource);
  }

  addExclude(resource: string, action) {
    if (!action.resource.exclude) {
      action.resource = {include: "*/*", exclude: []};
    }

    if (resource == "") {
      resource = this.trimResource("*/*", action.action);
    }

    (action.resource as {include: string; exclude: string[]}).exclude.push(resource);
  }

  removeIncluded(resourceIndex: number, action) {
    (action.resource as string[]).splice(resourceIndex, 1);
  }

  removeExcluded(resourceIndex: number, action) {
    (action.resource as {include: string; exclude: string[]}).exclude.splice(resourceIndex, 1);
    if (!action.resource.exclude.length) {
      delete action.resource.exclude;
      action.resource = ["*/*"];
    }
  }

  copyResources() {
    this.data.statement["actions"].map(action => {
      const currentAction = this.getAction(this.data.action);
      action.resource = JSON.parse(JSON.stringify(currentAction.resource));
      if (action.action != this.data.action) {
        if (this.getResourceSelection(currentAction) == "include") {
          action.resource.forEach((resource, resourceIndex) => {
            action.resource[resourceIndex] = this.trimResource(resource, action.action);
          });
        } else if (this.getResourceSelection(currentAction) == "exclude") {
          action.resource.include = this.trimResource(action.resource.include, action.action);
          action.resource.exclude.forEach((resource, resourceIndex) => {
            action.resource.exclude[resourceIndex] = this.trimResource(resource, action.action);
          });
        }
      }
    });
  }

  private trimResource(resource: string, action: string) {
    const resourceArray = resource.split("/");
    resourceArray.forEach((_, resourceIndex) => {
      if (this.services[this.data.statement.module][action].length <= resourceIndex)
        resourceArray[resourceIndex] = "";
    });
    return resourceArray.filter(resource => resource != "").join("/");
  }
}
