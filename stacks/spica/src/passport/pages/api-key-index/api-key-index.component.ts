import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material";
import {ApiKey} from "src/passport/interfaces/api-key";
import {Observable, of, Subject, merge} from "rxjs";
import {switchMap, map} from "rxjs/operators";
import {ApiKeyService} from "src/passport/services/api-key.service";

@Component({
  selector: "app-api-key-index",
  templateUrl: "./api-key-index.component.html",
  styleUrls: ["./api-key-index.component.scss"]
})
export class ApiKeyIndexComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  displayedColumns = ["key", "name", "description", "actions"];

  apiKeys$: Observable<ApiKey[]>;
  refresh$: Subject<void> = new Subject<void>();

  constructor(private apiKeyService: ApiKeyService) {}

  ngOnInit(): void {
    this.apiKeys$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() =>
        this.apiKeyService.getApiKeys(
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
}
