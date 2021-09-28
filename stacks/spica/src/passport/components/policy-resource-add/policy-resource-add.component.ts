import {Component, Inject, OnInit} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {Resource, Services, isSelectableResource} from "@spica-client/passport/interfaces/service";
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
    this.resource = this.data.services[this.data.statement.module][
      this.data.currentAction.name
    ].map(resource => {
      const copy = this.deepCopy(resource);
      if (isSelectableResource(resource)) {
        if (typeof resource.source == "string") {
          copy.source = this.http.get<{_id: string}[]>(resource.source);
        } else {
          copy.source = resource.source;
        }

        if (resource.maps) {
          copy.source = copy.source.pipe(
            map(v => {
              for (const fn of resource.maps) {
                v = fn(v);
              }
              return v;
            })
          );
        }
      }
      return copy;
    });
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
