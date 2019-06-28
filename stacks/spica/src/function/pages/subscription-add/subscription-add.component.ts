import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable} from "rxjs";
import {filter, switchMap} from "rxjs/operators";
import {FunctionService} from "../../function.service";
import {emptySubscription, Subscription, Trigger} from "../../interface";
import {SubscriptionService} from "../../subscription.service";

@Component({
  selector: "subscription-add",
  templateUrl: "./subscription-add.component.html",
  styleUrls: ["./subscription-add.component.scss"]
})
export class SubscriptionAddComponent implements OnInit {
  public triggers: Observable<Trigger>;
  public subscription: Subscription = emptySubscription();

  constructor(
    private ss: SubscriptionService,
    private functionService: FunctionService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
    this.triggers = this.functionService.getTriggers("subscription");
  }

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.ss.get(params.id))
      )
      .subscribe(data => {
        this.subscription = {...emptySubscription(), ...data};
      });
  }

  add() {
    this.ss
      .add(this.subscription)
      .toPromise()
      .then(data => {
        this.router.navigate(["subscription"]);
      });
  }
}
