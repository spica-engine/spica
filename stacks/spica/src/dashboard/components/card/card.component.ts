import {Component, EventEmitter, Input, Output} from "@angular/core";
import {PassportService} from "@spica-client/passport";
import {Observable} from "rxjs";

@Component({
  selector: "dashboard-card",
  templateUrl: "./card.component.html",
  styleUrls: ["./card.component.scss"]
})
export class CardComponent {
  @Input() componentData$: Observable<any>;

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  token;

  constructor(private passport: PassportService) {
    this.token = this.passport.token;
  }
}
