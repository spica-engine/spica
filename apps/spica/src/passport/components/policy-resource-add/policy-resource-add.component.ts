import {Component, Inject, OnInit} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {
  SubResource,
  Services,
  isSelectableSubResource
} from "@spica-client/passport/interfaces/service";
import {DisplayedStatement, DisplayedAction} from "@spica-client/passport/interfaces/statement";
import {HttpClient} from "@angular/common/http";
import {map, shareReplay} from "rxjs/operators";
import {PassportService} from "@spica-client/passport/services/passport.service";
import {of} from "rxjs";

@Component({
  selector: "policy-resource-add",
  templateUrl: "./policy-resource-add.component.html",
  styleUrls: ["./policy-resource-add.component.scss"]
})
export class PolicyResourceAddComponent implements OnInit {
  resource: SubResource[] = [];

  constructor(
    public dialogRef: MatDialogRef<PolicyResourceAddComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      services: Services;
      statement: DisplayedStatement;
      currentAction: DisplayedAction;
    },
    private http: HttpClient,
    private passport: PassportService
  ) {}

  async ngOnInit() {
    const actualResource = this.data.services[this.data.statement.module].actions[
      this.data.currentAction.name
    ];

    for (const subResource of actualResource) {
      const copySubResource = this.deepCopy(subResource);
      if (isSelectableSubResource(subResource)) {
        if (typeof subResource.source == "string") {
          const isAllowed = await this.passport
            .checkAllowed(subResource.requiredAction)
            .toPromise();
          if (!isAllowed) {
            copySubResource.source = of([]);
            this.resource.push(copySubResource);
            break;
          }

          copySubResource.source = this.http
            .get<{_id: string}[]>(subResource.source)
            .pipe(shareReplay());
        } else {
          copySubResource.source = subResource.source;
        }

        if (subResource.maps) {
          copySubResource.source = copySubResource.source.pipe(
            map((v: any) => {
              for (const fn of subResource.maps) {
                v = fn(v);
              }
              return v;
            })
          );
        }
      }

      this.resource.push(copySubResource);

      if (!this.data.currentAction.resource.include.length) {
        this.addInclude();
      }
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
      const targetResourceParts = this.data.services[this.data.statement.module].actions[
        action.name
      ];

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
