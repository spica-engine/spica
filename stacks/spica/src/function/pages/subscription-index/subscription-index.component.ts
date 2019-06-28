import {Component, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {Subscription} from "../../interface";
import {SubscriptionService} from "../../subscription.service";

@Component({
  selector: "subscription-index",
  templateUrl: "./subscription-index.component.html",
  styleUrls: ["./subscription-index.component.scss"]
})
export class SubscriptionIndexComponent implements OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  public $data: Observable<Subscription[]>;
  refresh: Subject<void> = new Subject<void>();
  displayedColumns = ["_id", "url", "actions"];

  constructor(private ss: SubscriptionService) {}

  ngOnInit() {
    this.$data = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() =>
        this.ss.getAll(
          this.paginator.pageSize || 12,
          this.paginator.pageSize * this.paginator.pageIndex
        )
      ),
      map(subscriptions => {
        this.paginator.length = 0;
        if (subscriptions.meta && subscriptions.meta.total) {
          this.paginator.length = subscriptions.meta.total;
        }
        return subscriptions.data;
      })
    );
  }

  delete(id: string) {
    this.ss
      .delete(id)
      .toPromise()
      .then(() => this.refresh.next());
  }
}
