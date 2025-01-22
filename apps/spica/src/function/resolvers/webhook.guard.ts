import {Injectable} from "@angular/core";
import {WebhookService} from "../services/webhook.service";
import {Router} from "@angular/router";
import {take, map} from "rxjs/operators";

@Injectable({providedIn: "root"})
export class WebhookGuard {
  constructor(
    private webhookService: WebhookService,
    private router: Router
  ) {}

  canActivate() {
    return this.webhookService.getAll(1, 0, {_id: 1}).pipe(
      take(1),
      map(webhooks =>
        webhooks.meta.total ? true : this.router.createUrlTree(["webhook", "welcome"])
      )
    );
  }
}
