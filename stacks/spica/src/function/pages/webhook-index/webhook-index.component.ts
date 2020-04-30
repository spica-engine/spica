import {Component, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {Webhook} from "../../interface";
import {WebhookService} from "../../webhook.service";

@Component({
  selector: "webhook-index",
  templateUrl: "./webhook-index.component.html",
  styleUrls: ["./webhook-index.component.scss"]
})
export class WebhookIndexComponent implements OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  public $data: Observable<Webhook[]>;
  refresh: Subject<void> = new Subject<void>();
  displayedColumns = ["_id", "url", "actions"];

  constructor(private webhookService: WebhookService) {}

  ngOnInit() {
    this.$data = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() =>
        this.webhookService.getAll(
          this.paginator.pageSize || 12,
          this.paginator.pageSize * this.paginator.pageIndex
        )
      ),
      map(webhooks => {
        this.paginator.length = webhooks.meta.total;
        return webhooks.data;
      })
    );
  }

  delete(id: string) {
    this.webhookService
      .delete(id)
      .toPromise()
      .then(() => this.refresh.next());
  }
}
