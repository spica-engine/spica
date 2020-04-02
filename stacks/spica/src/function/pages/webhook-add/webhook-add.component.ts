import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable} from "rxjs";
import {filter, switchMap} from "rxjs/operators";
import {FunctionService} from "../../function.service";
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
    private webHookService: WebhookService,
    private functionService: FunctionService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
    //this.triggers = this.functionService.getTriggers("webhook");
  }

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.webHookService.get(params.id))
      )
      .subscribe(data => {
        this.webhook = {...emptyWebhook(), ...data};
      });
  }

  add() {
    this.webHookService
      .add(this.webhook)
      .toPromise()
      .then(data => {
        this.router.navigate(["webhook"]);
      });
  }
}
