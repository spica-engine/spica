import {animate, style, transition, trigger} from "@angular/animations";
import {Component, EventEmitter, OnInit, ViewChild} from "@angular/core";
import {MatPaginator, PageEvent} from "@angular/material/paginator";
import {Sort} from "@angular/material/sort";
import {ActivatedRoute, Router} from "@angular/router";
import {merge, Observable} from "rxjs";
import {flatMap, map, publishReplay, refCount, switchMap, take, tap} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketData} from "../../interfaces/bucket-entry";
import {BucketSettings} from "../../interfaces/bucket-settings";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {DomSanitizer} from "@angular/platform-browser";

@Component({
  selector: "bucket-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"],
  animations: [
    trigger("smooth", [
      transition(":enter", [style({opacity: 0}), animate("0.5s ease-out", style({opacity: 1}))]),
      transition(":leave", [style({opacity: 1}), animate("0.5s ease-in", style({opacity: 0}))])
    ])
  ]
})
export class IndexComponent implements OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  bucketId: string;
  schema$: Observable<Bucket>;
  data$: Observable<BucketData>;
  refresh = new EventEmitter();
  loaded: boolean;

  filter: {[key: string]: any} = {};
  sort: {[key: string]: number} = {};

  showScheduled: boolean = false;
  readOnly: boolean = true;

  displayedProperties: Array<string> = [];
  properties: Array<{name: string; title: string}> = [];

  $preferences: Observable<BucketSettings>;
  language: string;
  selectedItems: Array<string> = [];
  dataIds: Array<string> = [];

  guide: boolean = false;
  guideResponse: {[key: string]: string};
  guideUrls: any;

  readonly defaultPaginatorOptions = {
    pageSize: 10,
    pageIndex: 0,
    length: 0
  };

  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.$preferences = this.bs.getPreferences();

    this.schema$ = this.route.params.pipe(
      tap(params => {
        this.bucketId = params.id;
        this.showScheduled = false;

        this.filter = {};
        this.sort = {};
        this.paginator.pageIndex = this.defaultPaginatorOptions.pageIndex;
        this.paginator.pageSize = this.defaultPaginatorOptions.pageSize;
        this.paginator.length = this.defaultPaginatorOptions.length;
      }),
      flatMap(() => this.bs.getBucket(this.bucketId)),
      tap(schema => {
        this.guideResponse = {};
        this.readOnly = schema.readOnly;
        this.properties = [
          {name: "$$spicainternal_id", title: "_id"},
          ...Object.entries(schema.properties).map(([name, value]) => ({
            name,
            title: value.title
          })),
          {name: "$$spicainternal_schedule", title: "Scheduled"},
          {name: "$$spicainternal_actions", title: "Actions"}
        ];

        if (!schema.readOnly) {
          this.properties.unshift({name: "$$spicainternal_select", title: "Select"});
        }

        const cachedDisplayedProperties = JSON.parse(
          localStorage.getItem(`${this.bucketId}-displayedProperties`)
        );

        //eliminate the properties which are not included by schema
        this.displayedProperties = cachedDisplayedProperties
          ? cachedDisplayedProperties.filter(dispProps =>
              Object.keys(schema.properties)
                .concat([
                  "$$spicainternal_id",
                  "$$spicainternal_schedule",
                  "$$spicainternal_actions",
                  "$$spicainternal_select"
                ])
                .some(schemaProps => schemaProps == dispProps)
            )
          : [
              ...Object.entries(schema.properties)
                .filter(([, value]) => value.options.visible)
                .map(([key]) => key),
              "$$spicainternal_actions"
            ];
      }),
      tap(schema => {
        Object.keys(schema.properties).map(key => {
          if (schema.properties[key].type == "relation") {
            this.bs
              .getBucket(schema.properties[key]["bucketId"])
              .pipe(take(1))
              .subscribe(bucket => (schema.properties[key]["primary"] = bucket.primary));
          }
        });
      }),
      publishReplay(),
      refCount()
    );

    this.data$ = merge(this.route.params, this.route.queryParams, this.refresh).pipe(
      tap(() => (this.loaded = false)),
      switchMap(params => {
        if (
          params &&
          (params["filter"] || params["paginator"] || params["sort"] || params["language"])
        ) {
          let paginationChanges: PageEvent = JSON.parse(params["paginator"]);
          this.paginator.pageIndex = paginationChanges.pageIndex;
          this.paginator.pageSize = paginationChanges.pageSize;
          this.paginator.length = paginationChanges.length;

          this.filter = JSON.parse(params["filter"]);
          this.sort = JSON.parse(params["sort"]);
          this.language = params["language"];
        }

        return this.bds.find(this.bucketId, {
          language: this.language,
          filter: this.filter && Object.keys(this.filter).length > 0 && this.filter,
          sort: Object.keys(this.sort).length > 0 ? this.sort : {_id: -1},
          limit: this.paginator.pageSize || 10,
          skip: this.paginator.pageSize * this.paginator.pageIndex,
          schedule: this.showScheduled
        });
      }),
      map(response => {
        this.selectedItems = [];
        this.paginator.length = (response.meta && response.meta.total) || 0;
        this.dataIds = response.data.map(d => d._id);
        this.loaded = true;
        let bucketUrl = `/bucket/${this.bucketId}/data?`;

        setTimeout(() => {
          let usableProperties = this.properties.filter(
            prop => !prop.name.startsWith("$$spicainternal_")
          );

          const firstProp = usableProperties[0] ? usableProperties[0].name : undefined;
          const secondProp = usableProperties[1] ? usableProperties[1].name : undefined;
          const firstPropValue =
            response.data.length && firstProp ? response.data[0][firstProp] : "";
          const secondPropValue =
            response.data.length && secondProp ? response.data[0][secondProp] : "";
          this.guideUrls = {
            getAllWithLimit: `${bucketUrl}limit=3`,
            getAllWithSort: `${bucketUrl}limit=3&sort={"${firstProp}":1}`,
            getWithFilter: `${bucketUrl}limit=3&filter={"${firstProp}":{"$regex":"${firstPropValue}"}}`,
            getWithLike: `${bucketUrl}limit=3&filter={"${firstProp}":{"$regex":"${firstPropValue}"}}`,
            getWithDoubleFilter: `${bucketUrl}limit=1&filter={"${firstProp}":{"$regex":"${firstPropValue}"},"${secondProp}":{"$regex":"${secondPropValue}"}}`,
            getOnlyScheduled: `${bucketUrl}paginate=true&limit=3&schedule=true`,
            getDataWithLang: `${bucketUrl}limit=3`
          };
        }, 1000);

        return response.data;
      })
    );
  }

  toggleDisplayAll(display: boolean, schema: Bucket) {
    if (display) {
      this.displayedProperties = [
        "$$spicainternal_select",
        "$$spicainternal_id",
        ...Object.keys(schema.properties),
        "$$spicainternal_schedule",
        "$$spicainternal_actions"
      ];
    } else {
      this.displayedProperties = [schema.primary, "$$spicainternal_actions"];
    }
    localStorage.setItem(
      `${this.bucketId}-displayedProperties`,
      JSON.stringify(this.displayedProperties)
    );
  }

  toggleProperty(name: string, selected: boolean) {
    if (selected) {
      this.displayedProperties.push(name);
    } else {
      this.displayedProperties.splice(this.displayedProperties.indexOf(name), 1);
    }
    this.displayedProperties = this.displayedProperties.sort(
      (a, b) =>
        this.properties.findIndex(p => p.name == a) - this.properties.findIndex(p => p.name == b)
    );
    localStorage.setItem(
      `${this.bucketId}-displayedProperties`,
      JSON.stringify(this.displayedProperties)
    );
  }

  toggleScheduled() {
    this.showScheduled = !this.showScheduled;
    let displayScheduleIndex = this.displayedProperties.indexOf("$$spicainternal_schedule");
    if (displayScheduleIndex > -1 && !this.showScheduled) {
      this.displayedProperties.splice(displayScheduleIndex, 1);
    }
    if (displayScheduleIndex == -1 && this.showScheduled) {
      let lastIndex = this.displayedProperties.lastIndexOf("$$spicainternal_actions");
      this.displayedProperties.splice(lastIndex, 0, "$$spicainternal_schedule");
    }
    localStorage.setItem(
      `${this.bucketId}-displayedProperties`,
      JSON.stringify(this.displayedProperties)
    );
    this.refresh.next();
  }

  onSortChange(sort: Sort) {
    if (sort.direction) {
      this.sort = {
        [sort.active.replace("$$spicainternal", "")]: sort.direction === "asc" ? 1 : -1
      };
    } else {
      this.sort = {};
    }

    this.router.navigate([], {
      queryParams: {
        filter: JSON.stringify(this.filter),
        paginator: JSON.stringify({
          pageSize: this.paginator.pageSize,
          pageIndex: this.paginator.pageIndex,
          length: this.paginator.length
        }),
        sort: JSON.stringify(this.sort),
        language: this.language
      }
    });
  }

  onPaginatorChange(changes: PageEvent) {
    this.router.navigate([], {
      queryParams: {
        paginator: JSON.stringify(changes),
        filter: JSON.stringify(this.filter),
        sort: JSON.stringify(this.sort),
        language: this.language
      }
    });
  }

  onFilterChange(changes: object) {
    this.router.navigate([], {
      queryParams: {
        filter: JSON.stringify(changes),
        paginator: JSON.stringify(this.defaultPaginatorOptions),
        sort: JSON.stringify(this.sort),
        language: this.language
      }
    });
  }

  onLanguageChange(language: string) {
    this.router.navigate([], {
      queryParams: {
        filter: JSON.stringify(this.filter),
        paginator: JSON.stringify(this.defaultPaginatorOptions),
        sort: JSON.stringify(this.sort),
        language: language
      }
    });
  }

  delete(id: string): void {
    this.bds
      .delete(this.bucketId, id)
      .toPromise()
      .then(() => this.refresh.emit());
  }

  deleteSelectedItems() {
    this.bds
      .deleteMany(this.bucketId, this.selectedItems)
      .toPromise()
      .then(() => this.refresh.emit());
  }
  guideRequest(url: string, key: string) {
    if (!this.guideResponse[key]) {
      this.bs
        .guideRequest(url, key == "getDataWithLang" ? {headers: {"Accept-Language": "tr-TR"}} : {})
        .pipe(take(1))
        .subscribe(returnedData => {
          this.guideResponse[key] = returnedData;
        });
    } else {
      this.guideResponse[key] = undefined;
    }
  }

  buildTemplate(value, property) {
    if (value == undefined || value == null) {
      return value;
    }
    switch (property.type) {
      case "object":
        return JSON.stringify(value);
      case "date":
        return new Date(value).toLocaleString();
      case "color":
        return this.sanitizer.bypassSecurityTrustHtml(
          `<div style='width:20px; height:20px; background-color:${value}; border-radius:3px'></div>`
        );
      case "relation":
        if (property["relationType"] == "onetomany") {
          return value.map(val =>
            val.hasOwnProperty(property.primary) ? val[property.primary] : val
          );
        } else {
          return value.hasOwnProperty(property.primary) ? value[property.primary] : value;
        }
      case "storage":
        return this.sanitizer.bypassSecurityTrustHtml(
          `<img style='width:100px; height:100px; margin:10px; border-radius:3px' src=${value} alt=${value}>`
        );
      default:
        return value;
    }
  }
}
