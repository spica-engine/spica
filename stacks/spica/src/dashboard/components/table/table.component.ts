import {
  Component,
  Input,
  OnInit,
  ViewChild,
  Output,
  EventEmitter,
  AfterViewInit
} from "@angular/core";
import {MatSort} from "@angular/material/sort";
import {MatTableDataSource} from "@angular/material/table";
import {MatPaginator} from "@angular/material/paginator";
import {Observable} from "rxjs";
import {tap, take} from "rxjs/operators";

@Component({
  selector: "dashboard-table",
  templateUrl: "./table.component.html",
  styleUrls: ["./table.component.scss"]
})
export class TableComponent implements OnInit, AfterViewInit {
  @Input() componentData$: Observable<any>;

  filter = {};

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  dataSource: MatTableDataSource<Object[]>;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort: MatSort;
  constructor() {}

  ngOnInit() {}

  ngAfterViewInit() {}

  refresh() {
    this.onUpdate.next(this.filter);
  }
}
