import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {MatLegacyPaginator as MatPaginator} from "@angular/material/legacy-paginator";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap, tap, take} from "rxjs/operators";
import {Identity, IdentitySchema, FilterSchema} from "../../interfaces/identity";
import {IdentityService} from "../../services/identity.service";
import {PreferencesService} from "@spica-client/core";
import {DomSanitizer} from "@angular/platform-browser";
import {Sort} from "@angular/material/sort";
import {PolicyService} from "@spica-client/passport/services/policy.service";

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

  selectableItemIds = [];

  displayedProperties = [];

  properties: Array<{name: string; title: string}> = [];

  selectedItemIds: Array<string> = [];

  schema: IdentitySchema = {
    properties: {
      identifier: {
        type: "string",
        title: "Identifier"
      },
      policies: {
        type: "array",
        title: "Policies",
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
    public preference: PreferencesService,
    public policyService: PolicyService
  ) {}

  ngOnInit() {
    this.preference
      .get("passport")
      .pipe(
        tap(pref => {
          this.filterSchema = {properties: {...this.schema.properties}};
          if (
            pref &&
            pref.identity &&
            pref.identity.attributes &&
            Object.keys(pref.identity.attributes.properties || {}).length
          ) {
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

          const cachedDisplayedProperties = JSON.parse(
            localStorage.getItem("Identities-displayedProperties")
          );

          this.displayedProperties = cachedDisplayedProperties
            ? cachedDisplayedProperties
            : this.properties.map(prop => prop.name);
        })
      )
      .pipe(take(1))
      .subscribe();

    this.identities$ = merge(this.paginator.page, of(null), this.refresh$).pipe(
      switchMap(() => this.policyService.find()),
      switchMap(policies =>
        this.identity
          .find(
            this.paginator.pageSize || 10,
            this.paginator.pageSize * this.paginator.pageIndex,
            this.sort,
            this.filter,
            true
          )
          .pipe(
            // convert identity policy ids to policy names
            map(response => {
              return {
                meta: response.meta,
                data: response.data.map(identity => {
                  for (const [index, id] of identity.policies.entries()) {
                    const policy = policies.data.find(policy => policy._id == id);
                    if (policy) {
                      identity.policies[index] = policy.name;
                    }
                  }
                  return identity;
                })
              };
            })
          )
      ),
      map(response => {
        this.paginator.length = response.meta.total;
        return response.data;
      }),
      tap(identities => {
        const systemUserIndex = identities.findIndex(identity => identity.identifier == "spica");
        if (systemUserIndex != -1) {
          identities[systemUserIndex].system = true;
        }
        this.selectableItemIds = identities.map(identity => identity._id);
        this.selectableItemIds.splice(systemUserIndex, 1);
        this.selectedItemIds = [];
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
      case "color":
        return this.sanitizer.bypassSecurityTrustHtml(
          `<div style='width:20px; height:20px; background-color:${value}; border-radius:3px'></div>`
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

    localStorage.setItem(
      "Identities-displayedProperties",
      JSON.stringify(this.displayedProperties)
    );
  }

  toggleDisplayAll(display: boolean) {
    if (display) {
      this.displayedProperties = this.properties.map(prop => prop.name);
    } else {
      this.displayedProperties = ["identifier", "$$spicainternal_actions"];
    }

    localStorage.setItem(
      "Identities-displayedProperties",
      JSON.stringify(this.displayedProperties)
    );
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
      const formattedProperty = this.pushPrefixIfAttributeProperty(property);
      this.filter[formattedProperty] = value;
    }

    this.refresh$.next();
  }

  async deleteSelectedItems() {
    await Promise.all(this.selectedItemIds.map(id => this.identity.deleteOne(id).toPromise()));
    this.refresh$.next();
  }
}
