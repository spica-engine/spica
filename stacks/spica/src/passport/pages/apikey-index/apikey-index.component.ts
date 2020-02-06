import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material";
import {ApiKey} from "src/passport/interfaces/apikey";
import {Observable, of, Subject, merge} from "rxjs";
import {switchMap, map} from "rxjs/operators";
import {ApiKeyService} from "src/passport/services/apikey.service";

@Component({
  selector: "passport-apikey-index",
  templateUrl: "./apikey-index.component.html",
  styleUrls: ["./apikey-index.component.scss"]
})
export class ApiKeyIndexComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  displayedColumns = ["key", "name", "description", "actions"];

  apiKeys$: Observable<ApiKey[]>;
  refresh$: Subject<void> = new Subject<void>();

  constructor(private apiKeyService: ApiKeyService) {}

  ngOnInit() {
    this.apiKeys$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() =>
        this.apiKeyService.getAll(
          this.paginator.pageSize || 10,
          this.paginator.pageSize * this.paginator.pageIndex
        )
      ),
      map(response => {
        this.paginator.length = response.meta.total;
        return response.data;
      })
    );
  }

  deleteApiKey(id: string) {
    this.apiKeyService
      .delete(id)
      .toPromise()
      .then(() => this.refresh$.next());
  }
}
