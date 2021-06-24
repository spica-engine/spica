import {Component, Input, Output, EventEmitter} from "@angular/core";
import {Observable} from "rxjs";

@Component({
  selector: "dashboard-default",
  templateUrl: "./default.component.html",
  styleUrls: ["./default.component.scss"]
})
export class DefaultComponent {
  @Input() componentData$: Observable<any>;
  @Input() type: string;
  @Output() onUpdate: EventEmitter<object> = new EventEmitter();
}
