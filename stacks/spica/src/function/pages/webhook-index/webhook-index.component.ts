import {Component, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {Webhook} from "../../interface";
import {WebhookService} from "../../services/webhook.service";

@Component({
  selector: "webhook-index",
  templateUrl: "./webhook-index.component.html",
  styleUrls: ["./webhook-index.component.scss"]
})
export class WebhookIndexComponent implements OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  public $data: Observable<Webhook[]>;
  refresh: Subject<void> = new Subject<void>();

  properties = ["_id", "title", "url", "type", "collection", "actions"];
  displayedProperties = JSON.parse(localStorage.getItem("Webhooks-displayedProperties")) || [
    "_id",
    "title",
    "url",
    "actions"
  ];

  sort: {[k: string]: number} = {_id: -1};

  constructor(private webhookService: WebhookService) {}

  ngOnInit() {
    this.$data = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() =>
        this.webhookService.getAll(
          this.paginator.pageSize || 12,
          this.paginator.pageSize * this.paginator.pageIndex,
          this.sort
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

  toggleProperty(name: string, selected: boolean) {
    if (selected) {
      this.displayedProperties.push(name);
    } else {
      this.displayedProperties.splice(this.displayedProperties.indexOf(name), 1);
    }

    this.displayedProperties = this.displayedProperties.sort(
      (a, b) => this.properties.indexOf(a) - this.properties.indexOf(b)
    );

    localStorage.setItem("Webhooks-displayedProperties", JSON.stringify(this.displayedProperties));
  }

  toggleDisplayAll(display: boolean) {
    if (display) {
      this.displayedProperties = JSON.parse(JSON.stringify(this.properties));
    } else {
      this.displayedProperties = ["_id", "title", "url", "actions"];
    }

    localStorage.setItem("Webhooks-displayedProperties", JSON.stringify(this.displayedProperties));
  }

  onSortChange(sort) {
    const property = sort.active != "id" || " url" ? `trigger.options.${sort.active}` : sort.active;
    if (sort.direction) {
      this.sort = {
        [property]: sort.direction === "asc" ? 1 : -1
      };
    } else {
      this.sort = {_id: -1};
    }

    this.refresh.next();
  }
}
