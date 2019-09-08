import {Component} from "@angular/core";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";
import {BucketService} from "../../services/bucket.service";

@Component({
  selector: "property-language",
  templateUrl: "./language.component.html",
  styleUrls: ["./language.component.scss"]
})
export class PropertyLanguageComponent {
  selected: string;
  default: string;
  languages$: Observable<
    {
      name: string;
      code: string;
    }[]
  >;

  constructor(bs: BucketService) {
    this.languages$ = bs.getPreferences().pipe(
      map(prefs => {
        this.default = this.selected = prefs.language.default.code;
        return prefs.language.supported_languages;
      })
    );
  }
}
