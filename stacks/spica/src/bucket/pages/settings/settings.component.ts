import {Component} from "@angular/core";
import {Router} from "@angular/router";
import {PreferencesService} from "@spica-client/core";

import {BucketSettings} from "../../interfaces/bucket-settings";

@Component({
  selector: "bucket-settings",
  templateUrl: "./settings.component.html",
  styleUrls: ["./settings.component.scss"]
})
export class SettingsComponent {
  public bucketSettings: BucketSettings;

  constructor(private router: Router, private pref: PreferencesService) {
    pref.get<BucketSettings>("bucket").subscribe(settings => (this.bucketSettings = settings));
  }

  addLanguage(name: string, code: string) {
    const {
      language: {supported_languages}
    } = this.bucketSettings;

    supported_languages.push({name, code});
  }

  updateSettings(): void {
    this.pref.update(this.bucketSettings).subscribe(() => this.router.navigate(["buckets"]));
  }
}
