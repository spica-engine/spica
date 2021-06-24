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

  onSubmit(form, button, inputs = []) {
    const query = {};
    for (const input of inputs) {
      query[input.key] = input.value;
    }

    const params = new HttpParams({fromObject: query});
    const url = button.target + "?" + params.toString();
    form.action = url;

    form.submit();
  }
}
