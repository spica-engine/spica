import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {Identity} from "../../interfaces/identity";
import {IdentityService} from "../../services/identity.service";

@Component({
  selector: "function-identity-index",
  templateUrl: "./identity-index.component.html",
  styleUrls: ["./identity-index.component.scss"]
})
export class IdentityIndexComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  identities$: Observable<Identity[]>;
  refresh$: Subject<void> = new Subject<void>();

  displayedColumns = ["_id", "identifier", "actions"];

  constructor(public identity: IdentityService) {}

  ngOnInit(): void {
    this.identities$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() =>
        this.identity.find(
          this.paginator.pageSize || 10,
          this.paginator.pageSize * this.paginator.pageIndex
        )
      ),
      map(identities => {
        this.paginator.length = identities.meta.total;
        return identities.data;
      })
    );
  }

  delete(id: string) {
    this.identity
      .deleteOne(id)
      .toPromise()
      .then(() => this.refresh$.next());
  }
}
