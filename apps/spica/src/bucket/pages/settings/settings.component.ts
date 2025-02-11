import {Component, OnInit} from "@angular/core";
import {Router} from "@angular/router";
import {PreferencesService} from "@spica-client/core";
import {take} from "rxjs/operators";
import {BucketSettings} from "../../interfaces/bucket-settings";
import {default as languages} from "./languages";

@Component({
  selector: "bucket-settings",
  templateUrl: "./settings.component.html",
  styleUrls: ["./settings.component.scss"]
})
export class SettingsComponent implements OnInit {
  settings: BucketSettings;
  languages = languages;

  constructor(
    private router: Router,
    private pref: PreferencesService
  ) {}

  ngOnInit(): void {
    this.pref
      .get<BucketSettings>("bucket")
      .pipe(take(1))
      .subscribe(settings => (this.settings = settings));
  }

  addLanguage(code: string) {
    this.settings.language.available[code] = this.languages.find(l => l.code == code).name;
  }

  remove(code: string) {
    if (this.settings.language.default != code) {
      delete this.settings.language.available[code];
    }
  }

  updateSettings(): void {
    this.pref
      .replaceOne(this.settings)
      .toPromise()
      .then(() => this.router.navigate(["buckets"]));
  }
}
