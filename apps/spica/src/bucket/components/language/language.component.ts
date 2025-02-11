import {Component, Input} from "@angular/core";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";
import {BucketService} from "../../services/bucket.service";
import {NgModel} from "@angular/forms";

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

  @Input() model: NgModel;

  constructor(bs: BucketService) {
    this.languages$ = bs.getPreferences().pipe(
      map(prefs => {
        this.default = this.selected = prefs.language.default;
        return Object.entries(prefs.language.available).map(([code, name]) => ({code, name}));
      })
    );
  }

  onLanguageChange() {
    setTimeout(() => {
      if (this.model && this.model.value == undefined) {
        this.model.control.reset();
      }
    }, 1);
  }
}
