import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable} from "rxjs";
import {filter, switchMap} from "rxjs/operators";
import {emptyWebhook, Webhook, Trigger} from "../../interface";
import {WebhookService} from "../../webhook.service";

@Component({
  selector: "webhook-add",
  templateUrl: "./webhook-add.component.html",
  styleUrls: ["./webhook-add.component.scss"]
})
export class WebhookAddComponent implements OnInit {
  public triggers: Observable<Trigger>;
  public webhook: Webhook = emptyWebhook();

  constructor(
    private webhookService: WebhookService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.triggers = this.webhookService.getTriggers();

    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.webhookService.get(params.id))
      )
      .subscribe(data => {
        this.webhook = {...emptyWebhook(), ...data};
      });
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
}
