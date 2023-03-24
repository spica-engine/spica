import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges
} from "@angular/core";
import {Observable} from "rxjs";
import {map, tap} from "rxjs/operators";

@Component({
  selector: "dashboard-default",
  templateUrl: "./default.component.html",
  styleUrls: ["./default.component.scss"]
})
export class DefaultComponent implements OnInit {
  @Input() componentData$: Observable<any>;
  @Input() type: string;
  @Input() ratio: string = "";
  @Input() refresh: boolean;

  @Output() isHovered = new EventEmitter<boolean>();

  public showChart: boolean = false;

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

  onShowChartClicked() {
    this.showChart = !this.showChart;
    this.isHovered.emit(this.showChart);
  }
}
