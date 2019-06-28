import {Component, OnInit, ViewChild} from "@angular/core";
import {Router} from "@angular/router";
import {PreferencesMeta, PreferencesService} from "@spica-client/core";
import {slugify} from "@spica-client/core";

@Component({
  selector: "identity-settings",
  templateUrl: "./identity-settings.component.html",
  styleUrls: ["./identity-settings.component.scss"]
})
export class IdentitySettingsComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar;

  preferences: PassportPreference;

  selectedInput;
  constructor(private router: Router, private preferencesService: PreferencesService) {}

  ngOnInit() {
    this.preferencesService
      .get<PassportPreference>("passport")
      .toPromise()
      .then(data => (this.preferences = data));
  }

  addAttribute(): void {
    this.preferences.identity.custom_attributes.push({
      name: "title_of_the_string",
      schema: {
        type: "string",
        title: "Title of the string",
        description: "Description of the attribute"
      }
    });
  }

  removeAttribute(index): void {
    this.preferences.identity.custom_attributes.splice(index, 1);
  }

  saveSettings() {
    this.preferencesService
      .update(this.preferences)
      .toPromise()
      .then(() => this.router.navigate(["/passport/identities"]));
  }

  slugifyAttributeTitle($event, index): void {
    this.preferences.identity.custom_attributes[index].name = slugify($event.title);
  }
}

export interface PassportPreference extends PreferencesMeta {
  identity: {
    custom_attributes: [
      {
        name: string;
        schema: {type: string; title: string; description: string};
      }
    ];
  };
}
