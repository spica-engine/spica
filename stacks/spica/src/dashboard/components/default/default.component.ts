import {Component, Input, Output, EventEmitter} from "@angular/core";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";

@Component({
  selector: "dashboard-default",
  templateUrl: "./default.component.html",
  styleUrls: ["./default.component.scss"]
})
export class DefaultComponent {
  @Input() componentData$: Observable<any>;
  @Input() type: string;

  filter = {};

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  constructor() {}

  ngOnInit() {
    this.componentData$ = this.componentData$.pipe(
      tap(componentData => {
        for (const f of componentData.filters) {
          this.filter[f.key] = f.value;
        }
      })
    );
  }

  refresh() {
    this.onUpdate.next(this.filter);
  }
}
