import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatLegacyPaginator as MatPaginator} from "@angular/material/legacy-paginator";
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

  properties = ["_id", "key", "name", "description", "active", "policies", "actions"];
  displayedProperties = JSON.parse(localStorage.getItem("Apikeys-displayedProperties")) || [
    "key",
    "name",
    "description",
    "actions"
  ];
  apiKeys$: Observable<ApiKey[]>;
  refresh$: Subject<void> = new Subject<void>();

  sort: {[key: string]: number} = {_id: -1};

  constructor(private apiKeyService: ApiKeyService) {}

  ngOnInit() {
    this.apiKeys$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() =>
        this.apiKeyService.getAll(
          this.paginator.pageSize || 10,
          this.paginator.pageSize * this.paginator.pageIndex,
          this.sort
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

  toggleProperty(name: string, selected: boolean) {
    if (selected) {
      this.displayedProperties.push(name);
    } else {
      this.displayedProperties.splice(this.displayedProperties.indexOf(name), 1);
    }

    this.displayedProperties = this.displayedProperties.sort(
      (a, b) => this.properties.indexOf(a) - this.properties.indexOf(b)
    );

    localStorage.setItem("Apikeys-displayedProperties", JSON.stringify(this.displayedProperties));
  }

  toggleDisplayAll(display: boolean) {
    if (display) {
      this.displayedProperties = JSON.parse(JSON.stringify(this.properties));
    } else {
      this.displayedProperties = ["key", "name", "description", "actions"];
    }

    localStorage.setItem("Apikeys-displayedProperties", JSON.stringify(this.displayedProperties));
  }

  onSortChange(sort) {
    if (!sort.direction) {
      this.sort = {_id: -1};
    } else {
      this.sort = {
        [sort.active]: sort.direction === "asc" ? 1 : -1
      };
    }

    this.refresh$.next();
  }
}
