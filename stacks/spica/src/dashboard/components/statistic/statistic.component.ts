import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {Ratio} from "@spica-client/dashboard/interfaces";
import {Observable} from "rxjs";

@Component({
  selector: "dashboard-statistic",
  templateUrl: "./statistic.component.html",
  styleUrls: ["./statistic.component.scss"]
})
export class StatisticComponent implements OnInit {
  @Input() componentData$: Observable<any>;
  @Input() ratio: Ratio;

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();
  constructor() {}

  ngOnInit(): void {}
}
