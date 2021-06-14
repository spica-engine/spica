import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {DomSanitizer} from "@angular/platform-browser";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";

@Component({
  selector: "dashboard-card",
  templateUrl: "./card.component.html",
  styleUrls: ["./card.component.scss"]
})
export class CardComponent implements OnInit {
  @Input() componentData$: Observable<any>;
  @Input() type: string;

  filter = {};

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  constructor(private sanitizer: DomSanitizer) {}

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
