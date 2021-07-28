import {HttpParams} from "@angular/common/http";
import {Component, EventEmitter, Input, Output} from "@angular/core";
import {Observable} from "rxjs";

@Component({
  selector: "dashboard-card",
  templateUrl: "./card.component.html",
  styleUrls: ["./card.component.scss"]
})
export class CardComponent {
  @Input() componentData$: Observable<any>;

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();
}
