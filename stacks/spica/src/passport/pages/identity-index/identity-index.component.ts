import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap, tap, take} from "rxjs/operators";
import {Identity, IdentitySchema, FilterSchema} from "../../interfaces/identity";
import {IdentityService} from "../../services/identity.service";
import {PreferencesService} from "@spica-client/core";
import {DomSanitizer} from "@angular/platform-browser";
import {Sort} from "@angular/material/sort";

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

  displayedProperties = [];

  properties: Array<{name: string; title: string}> = [];

  selectedItems: Array<string> = [];

  schema: IdentitySchema = {
    properties: {
      identifier: {
        type: "string",
        title: "Identifier"
      },
      policies: {
        type: "array",
        title: "policies",
        items: {
          type: "string"
        }
      }
    }
  };

  attributeSchema: IdentitySchema = {properties: {}};

  filterSchema: FilterSchema = {properties: {}};

  sort: {[key: string]: 1 | -1} = {_id: 1};

  filter: {[key: string]: any} = {};

  constructor(
    private sanitizer: DomSanitizer,
    public identity: IdentityService,
    public preference: PreferencesService
  ) {}

  ngOnInit(): void {
    this.preference
      .get("passport")
      .pipe(
        tap(pref => {
          this.filterSchema = {properties: {...this.schema.properties}};
          if (pref && Object.keys(pref.identity.attributes.properties || {}).length) {
            this.attributeSchema = {properties: pref.identity.attributes.properties};
            this.filterSchema.properties = {
              ...this.schema.properties,
              ...this.attributeSchema.properties
            };
          }

          this.properties = [
            {name: "$$spicainternal_select", title: "Select"},
            {name: "$$spicainternal_id", title: "_id"},
            ...Object.entries(this.schema.properties).map(([name, value]) => ({
              name,
              title: value.title
            })),
            ...(this.attributeSchema
              ? Object.entries(this.attributeSchema.properties).map(([name, value]) => ({
                  name,
                  title: value["title"]
                }))
              : []),
            {name: "$$spicainternal_actions", title: "Actions"}
          ];

          this.displayedProperties = this.properties.map(prop => prop.name);
        })
      )
      .pipe(take(1))
      .subscribe();

    this.identities$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() =>
        this.identity.find(
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

  delete(id: string) {
    this.identity
      .deleteOne(id)
      .toPromise()
      .then(() => this.refresh$.next());
  }

  onSortChange(sort: Sort) {
    let property = sort.active.replace("$$spicainternal", "");
    property = this.pushPrefixIfAttributeProperty(property);
    if (sort.direction) {
      this.sort = {
        [property]: sort.direction === "asc" ? 1 : -1
      };
    } else {
      this.sort = {_id: 1};
    }

    this.refresh$.next();
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
  }

  toggleDisplayAll(display: boolean) {
    if (display) {
      this.displayedProperties = this.properties.map(prop => prop.name);
    } else {
      this.displayedProperties = ["identifier", "$$spicainternal_actions"];
    }
  }

  pushPrefixIfAttributeProperty(property: string) {
    if (this.attributeSchema) {
      const attributeProps = Object.keys(this.attributeSchema.properties);
      if (attributeProps.includes(property)) {
        return `attributes.${property}`;
      }
    }
    return property;
  }

  onFilterChange(filter: {[key: string]: string}) {
    if (!Object.keys(filter).length) {
      this.filter = {};
    }

    for (const [property, value] of Object.entries(filter)) {
      const mappedProperty = this.pushPrefixIfAttributeProperty(property);
      this.filter[mappedProperty] = value;
    }

    this.refresh$.next();
  }
}
