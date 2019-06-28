import {Component, OnInit, ViewChild} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Subject} from "rxjs";
import {filter, switchMap, takeUntil} from "rxjs/operators";
import {ICONS} from "src/bucket/icons";
import {emptyStrategy, EMPTY_STRATEGY, Strategy} from "../../interfaces/strategy";
import {StrategyService} from "../../strategy.service";

@Component({
  selector: "strategies-add",
  templateUrl: "./strategies-add.component.html",
  styleUrls: ["./strategies-add.component.scss"]
})
export class StrategiesAddComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar;

  readonly icons: Array<string> = ICONS;
  readonly iconPageSize = 21;
  public visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  strategy: Strategy = emptyStrategy();
  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private strategyService: StrategyService
  ) {}

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        takeUntil(this.onDestroy),
        switchMap(params => this.strategyService.getStrategy(params.id))
      )
      .subscribe(strategyData => {
        this.strategy = {...EMPTY_STRATEGY, ...strategyData};
      });
  }

  submitForm() {
    this.strategyService
      .updateStrategy(this.strategy)
      .then(() => this.router.navigate(["passport/strategies"]));
  }
}
