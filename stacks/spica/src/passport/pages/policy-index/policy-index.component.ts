import {Component, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {Router} from "@angular/router";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {PolicyService} from "../../services/policy.service";
import {Policy} from "../../interfaces/policy";

@Component({
  selector: "passport-policy-index",
  templateUrl: "./policy-index.component.html",
  styleUrls: ["./policy-index.component.scss"]
})
export class PolicyIndexComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar;

  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  policies$: Observable<Policy[]>;
  refresh: Subject<void> = new Subject<void>();
  displayedColumns = ["id", "name", "description", "actions"];

  constructor(private policyService: PolicyService, private router: Router) {}

  ngOnInit(): void {
    this.policies$ = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() =>
        this.policyService.find(
          this.paginator.pageSize || 50,
          this.paginator.pageSize * this.paginator.pageIndex
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

  delete(id): void {
    this.policyService.deletePolicy(id).subscribe(() => {
      this.refresh.next();
    });
  }
}
