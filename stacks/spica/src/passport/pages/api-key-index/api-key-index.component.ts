import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material";
import {ApiKey} from "src/passport/interfaces/api-key";
import {Observable, of, Subject, merge} from "rxjs";
import {switchMap, map} from "rxjs/operators";

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

  keys: ApiKey[] = [
    {
      _id: "1",
      description: "description1",
      name: "name1",
      policies: [],
      active: true
    },
    {
      _id: "2",
      description: "description2",
      name: "name2",
      policies: [],
      active: true
    },
    {
      _id: "3",
      description: "description3",
      name: "name3",
      policies: [],
      active: true
    }
  ];

  constructor() {}

  ngOnInit(): void {
    this.apiKeys$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() =>
        of({
          meta: {
            total: 3
          },
          data: this.keys
        })
      ),
      map(response => {
        this.paginator.length = response.meta.total;
        return response.data;
      })
    );
  }
}
