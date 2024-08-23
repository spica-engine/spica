import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {RefreshToken, FilterSchema, RefreshTokenSchema} from "../../interfaces/refreshtoken";
import {Observable, of, Subject, merge} from "rxjs";
import {switchMap, map} from "rxjs/operators";
import {RefreshTokenService} from "src/passport/services/refreshtoken.service";

@Component({
  selector: "passport-refreshtoken-index",
  templateUrl: "./refreshtoken-index.component.html",
  styleUrls: ["./refreshtoken-index.component.scss"]
})
export class RefreshTokenIndexComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  properties = ["_id", "token", "created_at", "expired_at", "identity", "actions"];
  displayedProperties = JSON.parse(localStorage.getItem("Refreshtoken-displayedProperties")) || [
    "_id",
    "token",
    "created_at",
    "expired_at",
    "identity",
    "actions"
  ];
  refreshToken$: Observable<RefreshToken[]>;
  refresh$: Subject<void> = new Subject<void>();

  schema: RefreshTokenSchema = {
    properties: {
      token: {
        type: "string",
        title: "Token"
      },
      identity: {
        type: "string",
        title: "Identity"
      },
    }
  };

  sort: {[key: string]: number} = {_id: -1};

  filterSchema: FilterSchema = {properties: {}};
  
  filter: {[key: string]: any} = {};

  constructor(private refreshTokenService: RefreshTokenService) {}

  ngOnInit() {
    this.filterSchema = {properties: {...this.schema.properties}};
    this.refreshToken$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() =>
        this.refreshTokenService.getAll(
          this.paginator.pageSize || 10,
          this.paginator.pageSize * this.paginator.pageIndex,
          this.sort,
          this.filter,
          true
        )
      ),
      map(response => {
        this.paginator.length = response.meta.total;
        return response.data;
      })
    );
  }

  deleteRefreshToken(id: string) {
    this.refreshTokenService
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

    localStorage.setItem("Refreshtoken-displayedProperties", JSON.stringify(this.displayedProperties));
  }

  toggleDisplayAll(display: boolean) {
    if (display) {
      this.displayedProperties = JSON.parse(JSON.stringify(this.properties));
    } else {
      this.displayedProperties = ["_id", "token", "created_at", "expired_at", "identity", "actions"];
    }

    localStorage.setItem("Refreshtoken-displayedProperties", JSON.stringify(this.displayedProperties));
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

  onFilterChange(filter: {[key: string]: string}) {
    if (!Object.keys(filter).length) {
      this.filter = {};
    }

    for (const [property, value] of Object.entries(filter)) {
      this.filter[property] = value;
    }

    this.refresh$.next();
  }
}
