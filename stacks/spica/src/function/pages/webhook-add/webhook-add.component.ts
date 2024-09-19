import {Component, EventEmitter, OnDestroy, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable, of, merge} from "rxjs";
import {
  filter,
  switchMap,
  takeUntil,
  tap,
  endWith,
  catchError,
  ignoreElements
} from "rxjs/operators";
import {emptyWebhook, Webhook} from "../../interface";
import {WebhookService} from "../../services";
import {SavingState} from "@spica-client/material";

@Component({
  selector: "webhook-add",
  templateUrl: "./webhook-add.component.html",
  styleUrls: ["./webhook-add.component.scss"]
})
export class WebhookAddComponent implements OnInit, OnDestroy {
  public webhook: Webhook = emptyWebhook();
  private dispose = new EventEmitter();

  collections$: Observable<string[]>;

  $save: Observable<SavingState>;

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
        tap(() => (this.$save = of(SavingState.Pristine))),
        takeUntil(this.dispose)
      )
      .subscribe(data => (this.webhook = data));
  }

  save() {
    const isInsert = !this.webhook._id;

    const save = isInsert
      ? this.webhookService.add(this.webhook)
      : this.webhookService.update({...this.webhook});

    this.$save = merge(
      of(SavingState.Saving),
      save.pipe(
        tap((webhook: Webhook) => {
          this.webhook = webhook;
          if (isInsert) {
            this.router.navigate([`webhook/${webhook._id}`]);
          }
        }),
        ignoreElements(),
        endWith(SavingState.Saved),
        catchError(() => of(SavingState.Failed))
      )
    );
  }

  ngOnDestroy() {
    this.dispose.next(null);
  }
}
