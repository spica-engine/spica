import {Component, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, of, Subject} from "rxjs";
import {switchMap} from "rxjs/operators";

import {FunctionService} from "../../function.service";
import {Function} from "../../interface";

@Component({
  selector: "function-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  public $data: Observable<Function[]>;
  refresh: Subject<void> = new Subject<void>();
  public displayedColumns = ["_id", "name", "description", "actions"];

  constructor(private functionService: FunctionService) {}

  ngOnInit() {
    this.$data = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() => this.functionService.getFunctions())
    );
  }

  delete(id: string): void {
    this.functionService
      .delete(id)
      .pipe(switchMap(() => this.functionService.delete(id)))
      .subscribe(() => {
        this.refresh.next();
      });
  }
}
