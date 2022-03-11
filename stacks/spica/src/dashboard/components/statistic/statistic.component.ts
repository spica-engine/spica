import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {Observable} from "rxjs";

@Component({
  selector: "dashboard-statistic",
  templateUrl: "./statistic.component.html",
  styleUrls: ["./statistic.component.scss"]
})
export class StatisticComponent implements OnInit {
  @Input() componentData$: Observable<any>;

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();
  constructor() {}

  ngOnInit(): void {}
}
