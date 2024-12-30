import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatLegacyPaginator as MatPaginator} from "@angular/material/legacy-paginator";
import {Router} from "@angular/router";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {Policy} from "../../interfaces/policy";
import {PolicyService} from "../../services/policy.service";

@Component({
  selector: "passport-policy-index",
  templateUrl: "./policy-index.component.html",
  styleUrls: ["./policy-index.component.scss"]
})
export class PolicyIndexComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;

  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  policies$: Observable<Policy[]>;
  refresh$: Subject<void> = new Subject<void>();

  currentPolicyState: "predefined" | "custom" | "all" = "all";

  filter: {system?: boolean} = {};

  displayedColumns = ["id", "name", "description", "actions"];

  constructor(private policyService: PolicyService, private router: Router) {}

  ngOnInit(): void {
    this.policies$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() =>
        this.policyService.find(
          this.paginator.pageSize || 100,
          this.paginator.pageSize * this.paginator.pageIndex,
          this.filter
        )
      ),
      map(response => {
        this.paginator.length = response.meta.total;
        return response.data;
      })
    );
  }

  copyPolicy(element: any) {
    const copyElement = (({name, description, statement}) => ({name, description, statement}))(
      element
    );
    this.router.navigate(["/passport/policy/add"], {
      queryParams: {template: JSON.stringify(copyElement)}
    });
  }

  async delete(id) {
    await this.policyService.deletePolicy(id).toPromise();
    this.refresh$.next();
  }

  filterPolicies() {
    switch (this.currentPolicyState) {
      case "all":
        this.currentPolicyState = "custom";
        this.filter = {system: false};
        break;
      case "custom":
        this.currentPolicyState = "predefined";
        this.filter = {system: true};
        break;
      case "predefined":
        this.currentPolicyState = "all";
        this.filter = {};
        break;
    }
    this.refresh$.next();
  }
}
