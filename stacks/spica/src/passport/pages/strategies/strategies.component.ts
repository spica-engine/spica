import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {merge, Observable, of, Subject} from "rxjs";
import {switchMap} from "rxjs/operators";
import {Strategy} from "../../interfaces/strategy";
import {StrategyService} from "../../services/strategy.service";

@Component({
  selector: "passport-strategies",
  templateUrl: "./strategies.component.html",
  styleUrls: ["./strategies.component.scss"]
})
export class StrategiesComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;

  strategies$: Observable<Strategy[]>;
  refresh$: Subject<void> = new Subject<void>();

  displayedColumns = ["name", "title", "actions"];

  constructor(private strategiesService: StrategyService) {}

  ngOnInit() {
    this.strategies$ = merge(of(null), this.refresh$).pipe(
      switchMap(() => this.strategiesService.getStrategies())
    );
  }

  delete(id: string) {
    this.strategiesService
      .deleteStrategy(id)
      .toPromise()
      .then(() => this.refresh$.next());
  }
}
