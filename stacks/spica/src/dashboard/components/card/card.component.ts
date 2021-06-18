import {HttpParams} from "@angular/common/http";
import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";

@Component({
  selector: "dashboard-card",
  templateUrl: "./card.component.html",
  styleUrls: ["./card.component.scss"]
})
export class CardComponent implements OnInit {
  @Input() componentData$: Observable<any>;

  inputs = {};

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  constructor() {}

  ngOnInit() {
    this.componentData$ = this.componentData$.pipe(
      tap(componentData => {
        if (componentData.inputs) {
          for (const input of componentData.inputs) {
            this.inputs[input.key] = input.value;
          }
        }
      })
    );
  }

  onSubmit(form, button) {
    const params = new HttpParams({fromObject: this.inputs});
    const url = button.target + "?" + params.toString();
    form.action = url;
    form.submit();
  }

  refresh() {
    this.onUpdate.next();
  }
}
