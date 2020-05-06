import {Component, EventEmitter, OnDestroy, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable} from "rxjs";
import {filter, switchMap, takeUntil} from "rxjs/operators";
import {emptyWebhook, Webhook} from "../../interface";
import {WebhookService} from "../../webhook.service";

@Component({
  selector: "webhook-add",
  templateUrl: "./webhook-add.component.html",
  styleUrls: ["./webhook-add.component.scss"]
})
export class WebhookAddComponent implements OnInit, OnDestroy {
  public webhook: Webhook = emptyWebhook();
  private dispose = new EventEmitter();

  collections$: Observable<string[]>;

  constructor(
    private webhookService: WebhookService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.collections$ = this.webhookService.getCollections();

    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.webhookService.get(params.id)),
        takeUntil(this.dispose)
      )
      .subscribe(data => (this.webhook = data));
  }

  save() {
    (this.webhook._id
      ? this.webhookService.update(this.webhook)
      : this.webhookService.add(this.webhook)
    )
      .toPromise()
      .then(() => {
        this.router.navigate(["webhook"]);
      });
  }

  ngOnDestroy() {
    this.dispose.next();
  }
}
