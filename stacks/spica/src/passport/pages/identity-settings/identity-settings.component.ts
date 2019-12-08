import {Component, OnInit, ViewChild} from "@angular/core";
import {Router, ActivatedRoute} from "@angular/router";
import {PreferencesMeta, PreferencesService} from "@spica-client/core";
import {JSONSchema7TypeName} from "json-schema";
import {InputSchema} from "@spica-client/common";
import {moveItemInArray, CdkDragDrop} from "@angular/cdk/drag-drop";
import {PredefinedDefault} from "../../interfaces/predefined-default";
import {flatMap, map, filter, takeUntil} from "rxjs/operators";
import {IdentityService} from "../../services/identity.service";
import {Subject} from "rxjs";

@Component({
  selector: "identity-settings",
  templateUrl: "./identity-settings.component.html",
  styleUrls: ["./identity-settings.component.scss"]
})
export class IdentitySettingsComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar;

  preferences: PassportPreference;
  public basicPropertyTypes = ["string", "textarea", "boolean", "number"];
  selectedInput: string;

  private onDestroy: Subject<void> = new Subject<void>();

  public predefinedDefaults: {[key: string]: PredefinedDefault[]};
  constructor(
    private router: Router,
    private preferencesService: PreferencesService,
    private activatedRoute: ActivatedRoute,
    private identityService: IdentityService
  ) {}

  ngOnInit() {
    this.preferencesService
      .get<PassportPreference>("passport")
      .toPromise()
      .then(data => {
        this.preferences = data;
        this.preferences.identity.attributes.properties =
          this.preferences.identity.attributes.properties || {};
      });

    this.activatedRoute.params
      .pipe(
        flatMap(params =>
          this.identityService.getPredefinedDefaults().pipe(
            map(predefs => {
              this.predefinedDefaults = predefs.reduce((accumulator, item) => {
                accumulator[item.type] = accumulator[item.type] || [];
                accumulator[item.type].push(item);
                return accumulator;
              }, {});
              return params;
            })
          )
        ),
        filter(params => params.id !== undefined),
        takeUntil(this.onDestroy)
      )
      .subscribe();
  }

  addProperty(propertyKey: string): void {
    if (propertyKey && !this.preferences.identity.attributes.properties[propertyKey]) {
      this.preferences.identity.attributes.properties[propertyKey.toLowerCase()] = {
        type: "string",
        title: propertyKey,
        description: `Description of '${propertyKey}'`,
        options: {}
      };
    }
  }

  deleteProperty(propertyKey: string) {
    if (propertyKey && this.preferences.identity.attributes.properties[propertyKey]) {
      delete this.preferences.identity.attributes.properties[propertyKey];
    }
  }

  saveSettings() {
    this.preferencesService
      .update(this.preferences)
      .toPromise()
      .then(() => this.router.navigate(["/passport/identity"]));
  }

  cardDrop(event: CdkDragDrop<PassportPreference[]>) {
    const properties = Object.entries(this.preferences.identity.attributes.properties);

    moveItemInArray(properties, event.previousIndex, event.currentIndex);

    this.preferences.identity.attributes.properties = properties.reduce(
      (accumulator, [key, value]) => {
        accumulator[key] = value;
        return accumulator;
      },
      {}
    );
  }
}

export interface PassportPreference extends PreferencesMeta {
  identity: {
    attributes: {
      required: string[];
      properties: {
        [key: string]: Property;
      };
    };
  };
}

export interface PropertyOptions {
  type: JSONSchema7TypeName | JSONSchema7TypeName[] | string;
  options?: {
    visible?: boolean;
  };
}

export type Property = InputSchema & PropertyOptions;
