import {HttpParams} from "@angular/common/http";
import {
  Component,
  Input,
  OnInit,
  ViewChild,
  EventEmitter,
  Output,
  AfterViewInit
} from "@angular/core";
import {MatSort} from "@angular/material/sort";
import {MatTableDataSource} from "@angular/material/table";
import {MatPaginator} from "@angular/material/paginator";
import {Component as DashboardComponent} from "../../interfaces";
import {DashboardService} from "@spica-client/dashboard/services/dashboard.service";

@Component({
  selector: "app-dashboard-table",
  templateUrl: "./dashboard-table.component.html",
  styleUrls: ["./dashboard-table.component.scss"]
})
export class DashboardTableComponent implements OnInit {
  @Input() componentData: any;

  dataSource: MatTableDataSource<Object[]>;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort: MatSort;
  constructor() {}

  ngOnInit() {
    this.dataSource = new MatTableDataSource(this.componentData.data);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }
}
