import {Component, Input, ViewChild, Output, EventEmitter, AfterViewInit} from "@angular/core";
import {MatSort} from "@angular/material/sort";
import {MatTableDataSource} from "@angular/material/table";
import {MatPaginator} from "@angular/material/paginator";
import {Observable, Subject} from "rxjs";
import {tap} from "rxjs/operators";

@Component({
  selector: "dashboard-table",
  templateUrl: "./table.component.html",
  styleUrls: ["./table.component.scss"]
})
export class TableComponent implements AfterViewInit {
  @Input() componentData$: Observable<any>;

  // we can not cover mat table with ngif
  // otherwise mat-sort won't work
  displayedColumns = [];

  filter = {};

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  dataSource: MatTableDataSource<Object[]>;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort: MatSort;

  constructor() {}

  ngAfterViewInit() {
    this.componentData$ = this.componentData$.pipe(
      tap(componentData => {
        this.displayedColumns = componentData.displayedColumns;

        this.dataSource = new MatTableDataSource(componentData.data);
        this.dataSource.sort = this.sort;
        this.dataSource.paginator = this.paginator;
      })
    );
  }

  refresh() {
    this.onUpdate.next(this.filter);
  }
}
