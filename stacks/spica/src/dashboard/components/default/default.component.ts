import {Component, Input, Output, EventEmitter, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";

@Component({
  selector: "dashboard-default",
  templateUrl: "./default.component.html",
  styleUrls: ["./default.component.scss"]
})
export class DefaultComponent implements OnInit {
  @Input() componentData$: Observable<any>;
  @Input() type: string;
  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  ngOnInit() {
    this.componentData$ = this.componentData$.pipe(
      map(data => {
        data.options = {
          ...data.options,
          responsive: true,
          maintainAspectRatio: false
        };
        return data;
      })
    );
  }
}
