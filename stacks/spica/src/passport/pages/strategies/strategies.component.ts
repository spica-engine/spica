import {Component, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material";
import {merge, Observable, of, Subject} from "rxjs";
import {switchMap} from "rxjs/operators";
import {Strategy} from "../../interfaces/strategy";
import {StrategyService} from "../../strategy.service";

@Component({
  selector: "passport-strategies",
  templateUrl: "./strategies.component.html",
  styleUrls: ["./strategies.component.scss"]
})
export class StrategiesComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar;

  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  refresh: Subject<void> = new Subject<void>();
  displayedColumns = ["name", "title", "actions"];

  strategies$: Observable<Strategy[]>;

  constructor(private strategiesService: StrategyService) {}

  ngOnInit() {
    this.strategies$ = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() => this.strategiesService.getStrategies().toPromise())
    );
  }

  delete(id: string) {
    this.strategiesService.deleteStrategy(id).toPromise().then(() => this.refresh.next());
  }
}
