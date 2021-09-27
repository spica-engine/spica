import {Component, Inject, OnInit} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {
  Resource,
  Services,
  isSelectableSubResource
} from "@spica-client/passport/interfaces/service";
import {NgModel} from "@angular/forms";
import {DisplayedStatement, DisplayedAction} from "@spica-client/passport/interfaces/statement";
import {HttpClient} from "@angular/common/http";
import {map} from "rxjs/operators";

@Component({
  selector: "policy-resource-add",
  templateUrl: "./policy-resource-add.component.html",
  styleUrls: ["./policy-resource-add.component.scss"]
})
export class PolicyResourceAddComponent implements OnInit {
  resource: Resource[];

  constructor(
    public dialogRef: MatDialogRef<PolicyResourceAddComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      services: Services;
      statement: DisplayedStatement;
      currentAction: DisplayedAction;
    },
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.resource = this.data.services[this.data.statement.module][this.data.currentAction.name];

    this.resource.forEach(sr => {
      if (isSelectableSubResource(sr)) {
        sr.values = sr.url
          ? this.http.get<{_id: string}[]>(sr.url).pipe(map(r => r.concat({_id: "*"})))
          : sr.values;
      }
    });
  }

  onIncludeTyping(model: NgModel) {
    let pattern = "";

    let reason = "";

    if (!this.data.currentAction.resource.exclude.length) {
      pattern = this.buildPattern("default");
      reason = "expectedFormat";
    } else {
      pattern = this.buildPattern("endswith");
      reason = "endsWith";
    }

    if (!new RegExp(pattern).test(model.value)) {
      model.control.setErrors({[reason]: true});
    }
  }

  buildPattern(type: "default" | "endswith") {
    const resourcePart = "[a-zA-Z0-9\\*]+";

    const lastSegment = "\\*$";

    const seperator = "\\/";

    switch (type) {
      case "default":
        return this.resource.map(() => resourcePart).join(seperator);
      case "endswith":
        return this.resource
          .map((_, index) => (index == this.resource.length - 1 ? lastSegment : resourcePart))
          .join(seperator);
    }
  }

  addInclude() {
    this.data.currentAction.resource.exclude = [];
    this.data.currentAction.resource.include.push("");
  }

  addExclude() {
    const included = this.resource.map(() => "*").join("/");

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
      const targetResourceParts = this.data.services[this.data.statement.module][action.name];

      if (targetResourceParts.length != this.resource.length) {
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

  selectionValue(
    target: "include" | "exclude",
    resourceIndex: number,
    subResourceIndex: number,
    values: any[]
  ) {
    const resource = this.data.currentAction.resource[target][resourceIndex];
    const subResources = resource.split("/");

    const value = subResources[subResourceIndex];

    return values.find(v => v._id == value);
  }

  onSubResourceChange(
    target: "include" | "exclude",
    resourceIndex: number,
    subResourceIndex: number,
    value: string
  ) {
    const resource = this.data.currentAction.resource[target][resourceIndex];
    const subResources = resource.split("/");

    subResources[subResourceIndex] = value;

    this.data.currentAction.resource[target][resourceIndex] = subResources.join("/");
  }
}
