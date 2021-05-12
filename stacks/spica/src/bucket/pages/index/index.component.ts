import {animate, style, transition, trigger} from "@angular/animations";
import {Component, EventEmitter, OnInit, ViewChild} from "@angular/core";
import {MatPaginator, PageEvent} from "@angular/material/paginator";
import {Sort} from "@angular/material/sort";
import {ActivatedRoute, Router} from "@angular/router";
import {merge, Observable} from "rxjs";
import {flatMap, map, publishReplay, refCount, switchMap, take, tap} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketData, BucketEntry} from "../../interfaces/bucket-entry";
import {BucketSettings} from "../../interfaces/bucket-settings";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {DomSanitizer} from "@angular/platform-browser";

@Component({
  selector: "bucket-data-index",
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

  templateMap = new Map<string, any>();

  dependents = [];

  selectedItemDependents = [];

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
  selectedItems: Array<BucketEntry> = [];
  dataIds: Array<string> = [];

  guide: boolean = false;
  guideResponse: {[key: string]: string};
  guideObjects: object;
  rootUrl: string;

  readonly defaultPaginatorOptions = {
    pageSize: 10,
    pageIndex: 0,
    length: 0
  };

  editModes = new Map<string, Set<string>>();

  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  openEditMode(id: string, key: string) {
    const editedFields = this.editModes.has(id) ? this.editModes.get(id) : new Set<string>();

    editedFields.add(key);

    this.editModes.set(id, editedFields);
  }

  onEditMode(id: string, key: string) {
    return this.editModes.has(id)
      ? Array.from(this.editModes.get(id).values()).findIndex(f => f == key) != -1
      : false;
  }

  blurEditMode(id: string, key: string) {
    const fields = this.editModes.get(id);

    if (!fields) {
      return;
    }

    fields.delete(key);

    this.editModes.set(id, fields);
  }

  ngOnInit(): void {
    this.rootUrl = window.location.origin;
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
              schema.primary || Object.keys(schema.properties)[0] || "$$spicainternal_id",
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
        const bucketUrl = `/bucket/${this.bucketId}/data?`;

        setTimeout(() => {
          const usableProperties = this.properties.filter(
            prop => !prop.name.startsWith("$$spicainternal_")
          );

          const firstProp = usableProperties[0] ? usableProperties[0].name : undefined;
          const secondProp = usableProperties[1] ? usableProperties[1].name : undefined;
          const firstPropValue =
            response.data.length && firstProp ? response.data[0][firstProp] : "";
          const secondPropValue =
            response.data.length && secondProp ? response.data[0][secondProp] : "";
          this.guideObjects = {
            getAllWithLimit: {
              title: "Get Limited Data",
              description:
                "To get all data using limits, simply you can add 'limit' [number] parameter as query params. You can try the live demo below.",
              url: `${bucketUrl}limit=3`
            },
            getAllWithSort: {
              title: "Get Limited Data With Sorting",
              description:
                "To sort your dataset, you can add 'sort' [object] parameter as query params. You can try the live demo below. ",
              url: `${bucketUrl}limit=3&sort={"${firstProp}":1}`
            },
            getWithFilterMongoDb: {
              title: "Get Filtered Data (MongoDB Match Aggregation)",
              description:
                "To filter your data, you can use MongoDB match aggregations in 'filter' [object] query parameter. You can try the live demo below.",
              url: `${bucketUrl}limit=3&filter={"${firstProp}":{"$regex":"${firstPropValue}"}}`
            },
            getWithFilterRulesEngine: {
              title: "Get Filtered Data (Spica Rules Engine) ",
              description:
                "To filter your data, you can use built-in 'Spica Rules' engine in 'filter' [string] query parameter. You can try the live demo below.",
              url: `${bucketUrl}limit=3&filter=${firstProp}=='${firstPropValue}'`
            },
            getWithDoubleFilter: {
              title: "Using Double Filter",
              description:
                "You can apply double filter to your requests as well. You can try the live demo below.",
              url: `${bucketUrl}limit=1&filter={"${firstProp}":{"$regex":"${firstPropValue}"},"${secondProp}":{"$regex":"${secondPropValue}"}}`
            },
            getOnlyScheduled: {
              title: "Get Scheduled Data",
              description:
                "You can get all scheduled data with using 'shcedule' [boolean] query parameter. You can try the live demo below.",
              url: `${bucketUrl}?limit=3&schedule=true`
            },
            getDataWithLang: {
              title: "Get Localized Data",
              description:
                "To get localized data, you can use 'Accept-Language' request header. As an example '{Accept-Language: \"en-EN\"}'",
              url: ``
            }
          };
        }, 1000);

        return response.data;
      })
    );
  }

  getDependents(schema: Bucket, entries: BucketEntry[]) {
    const dependents = new Set();

    for (const [name, definition] of Object.entries(schema.properties)) {
      for (const entry of entries) {
        if (definition.type == "relation" && definition["dependent"] && entry[name]) {
          const documents = Array.isArray(entry[name]) ? entry[name] : [entry[name]];

          for (const document of documents) {
            const text = `${definition["bucketId"]}/${document._id}`;
            dependents.add(text);
          }
        }
      }
    }

    return Array.from(dependents);
  }

  onItemSelected(isSelect: boolean, data: BucketEntry) {
    if (isSelect) {
      this.selectedItems.push(data);
    } else {
      this.selectedItems.splice(this.selectedItems.findIndex(entry => entry._id == data._id), 1);
    }
  }

  hasSelected(id: string) {
    return this.selectedItems.findIndex(item => item._id == id) != -1;
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

  saveBucketDocument(document:BucketEntry){
    console.log(document)
  }

  delete(id: string): void {
    this.bds
      .delete(this.bucketId, id)
      .toPromise()
      .then(() => this.refresh.emit());
  }

  deleteSelectedItems() {
    this.bds
      .deleteMany(this.bucketId, this.selectedItems.map(i => i._id))
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

  buildTemplate(value, property, name) {
    let result;

    const key = `${name}_${typeof value == "object" ? JSON.stringify(value) : value}`;

    if (this.templateMap.has(key)) {
      return this.templateMap.get(key);
    }

    if (value == undefined || value == null) {
      result = value;
    }
    switch (property.type) {
      case "object":
        result = JSON.stringify(value);
        break;
      case "date":
        result = new Date(value).toLocaleString();
        break;
      case "color":
        result = this.sanitizer.bypassSecurityTrustHtml(
          `<div style='width:20px; height:20px; background-color:${value}; border-radius:3px'></div>`
        );
        break;
      case "relation":
        if (this.isValidOnetoMany(property, value)) {
          result = value.map(val =>
            val.hasOwnProperty(property.primary) ? val[property.primary] : val
          );
        } else if (this.isValidOnetoOne(property, value)) {
          result = value.hasOwnProperty(property.primary) ? value[property.primary] : value;
        }
        break;
      case "storage":
        result = this.sanitizer.bypassSecurityTrustHtml(
          `<img style='width:100px; height:100px; margin:10px; border-radius:3px' src=${value} alt=${value}>`
        );
        break;
      case "location":
        result = [value.coordinates[1], value.coordinates[0]];
        break;
      default:
        result = value;
        break;
    }

    this.templateMap.set(key, result);

    return result;
  }

  isValidOnetoMany(property, value) {
    return property.relationType == "onetomany" && Array.isArray(value);
  }

  isValidOnetoOne(property, value) {
    return property.relationType == "onetoone" && typeof value == "object";
  }
}
