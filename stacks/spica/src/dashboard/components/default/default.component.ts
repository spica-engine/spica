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
  @Input() reset: boolean;

  @Output() isHovered = new EventEmitter<boolean>();

  // @Input() isHovered:boolean;

  public isChartHovered: boolean = false;

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
      }),
      tap(console.log)
    );
  }

  onChartHovered() {
    console.log("before hovered", this.isChartHovered);
    this.isChartHovered = true;
    console.log("after hovered", this.isChartHovered);
  }
  onChartUnHovered() {
    console.log("before unhovered", this.isChartHovered);
    this.isChartHovered = false;
    console.log("after unhovered", this.isChartHovered);
  }

  onClickDeneme(value: boolean) {
    this.isChartHovered = !value;
    this.isHovered.emit(this.isChartHovered);
  }
}
