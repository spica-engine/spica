import {Component, OnInit} from "@angular/core";
import {Scheme, SchemeObserver} from "@spica-client/core";
import {PassportService} from "@spica-client/passport";
import {Observable} from "rxjs";
import {startWith} from "rxjs/operators";

@Component({
  selector: "passport-access-token",
  templateUrl: "./access-token.component.html"
})
export class AccessTokenComponent {
  dark$: Observable<boolean>;
  constructor(private passport: PassportService, private schemeObserver: SchemeObserver) {
    this.dark$ = this.schemeObserver
      .observe(Scheme.Dark)
      .pipe(startWith(this.schemeObserver.isMatched(Scheme.Dark)));
  }
}
