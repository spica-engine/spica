import {Component, Input, Output, EventEmitter, OnInit} from "@angular/core";
import {Observable, Subject} from "rxjs";
import {map, tap} from "rxjs/operators";

@Component({
  selector: "dashboard-default",
  templateUrl: "./default.component.html",
  styleUrls: ["./default.component.scss"]
})
export class DefaultComponent implements OnInit {
  @Input() componentData$: Observable<any>;
  @Input() type: string;
  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  $subject: Subject<any>;

  ngOnInit() {
    this.componentData$ = this.componentData$.pipe(
      tap(() => {
        if (this.$subject) {
          this.$subject.complete();
        }
      }),
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

  onRefresh(filter) {
    this.$subject = new Subject();
    this.onUpdate.next(filter);
  }
}
