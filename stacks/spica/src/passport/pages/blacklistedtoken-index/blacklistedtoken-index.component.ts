import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {BlacklistedToken} from "src/passport/interfaces/blacklistedtoken";
import {Observable, of, Subject, merge} from "rxjs";
import {switchMap, map} from "rxjs/operators";
import {BlacklistedTokenService} from "src/passport/services/blacklistedtoken.service";
import { FilterSchema } from "@spica-client/passport/interfaces/identity";

@Component({
  selector: "passport-blacklistedtoken-index",
  templateUrl: "./blacklistedtoken-index.component.html",
  styleUrls: ["./blacklistedtoken-index.component.scss"]
})
export class BlacklistedTokenIndexComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  properties = ["_id", "token", "expires_in", "actions"];
  displayedProperties = JSON.parse(localStorage.getItem("Blacklistedtoken-displayedProperties")) || [
    "_id",
    "token",
    "expires_in",
    "actions"
  ];
  blacklistedToken$: Observable<BlacklistedToken[]>;
  refresh$: Subject<void> = new Subject<void>();

  sort: {[key: string]: number} = {_id: -1};

  filterSchema: FilterSchema = {properties: {}};
  
  filter: {[key: string]: any} = {};

  constructor(private blacklistedTokenService: BlacklistedTokenService) {}

  ngOnInit() {
    this.blacklistedToken$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() =>
        this.blacklistedTokenService.getAll(
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

  deleteBlacklistedToken(id: string) {
    this.blacklistedTokenService
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

    localStorage.setItem("Blacklistedtoken-displayedProperties", JSON.stringify(this.displayedProperties));
  }

  toggleDisplayAll(display: boolean) {
    if (display) {
      this.displayedProperties = JSON.parse(JSON.stringify(this.properties));
    } else {
      this.displayedProperties = ["_id", "token", "expires_in", "actions"];
    }

    localStorage.setItem("Blacklistedtoken-displayedProperties", JSON.stringify(this.displayedProperties));
  }

  onSortChange(sort) {
    console.log("sort: ", sort)
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
