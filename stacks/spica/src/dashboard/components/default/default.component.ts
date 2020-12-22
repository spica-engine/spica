import {Component, OnInit, Input, Output, EventEmitter} from "@angular/core";
import {Observable} from "rxjs";

@Component({
  selector: "dashboard-default",
  templateUrl: "./default.component.html",
  styleUrls: ["./default.component.scss"]
})
export class DefaultComponent implements OnInit {
  @Input() componentData$: Observable<any>;
  @Input() type: string;

  filter = {};

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  constructor() {}

  ngOnInit() {}

  refresh() {
    this.onUpdate.next(this.filter);
  }
}
