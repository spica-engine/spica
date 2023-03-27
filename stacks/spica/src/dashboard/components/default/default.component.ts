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
import { isSmallComponent, Ratio } from "@spica-client/dashboard/interfaces";


@Component({
  selector: "dashboard-default",
  templateUrl: "./default.component.html",
  styleUrls: ["./default.component.scss"]
})
export class DefaultComponent implements OnInit, OnChanges {
  @Input() componentData$: Observable<any>;
  @Input() type: string;
  @Input() ratio: Ratio;
  @Input() refresh: boolean;

  isSmall = false;

  @Output() isHovered = new EventEmitter<boolean>();

  public showChart: boolean = false;

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  ngOnInit() {
    console.log(this.ratio);
    
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
  ngOnChanges(){
    this.isSmall = isSmallComponent(this.ratio)
  }
}
