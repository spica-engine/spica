import {HttpClient, HttpParams} from "@angular/common/http";
import {Component, Input, OnInit, ViewChild} from "@angular/core";
import {MatSort, MatTableDataSource} from "@angular/material";
import {MatPaginator} from "@angular/material/paginator";
import {Component as DashboardComponent} from "../../interfaces";

@Component({
  selector: "app-dashboard-table",
  templateUrl: "./dashboard-table.component.html",
  styleUrls: ["./dashboard-table.component.scss"]
})
export class DashboardTableComponent implements OnInit {
  dataSource: MatTableDataSource<Object>;
  displayedColumns: string[];
  tableData: any;
  params: HttpParams = new HttpParams();
  @Input() data: DashboardComponent;
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort: MatSort;
  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.getData();
  }
  getData() {
    this.http.get(`api:/fn-execute/${this.data.target}`, {params: this.params}).subscribe(d => {
      Object.values(d).map(f => {
        if (f[this.data.key]) {
          this.dataSource = new MatTableDataSource(f[this.data.key].data);
          this.tableData = f[this.data.key];
          this.dataSource.paginator = this.paginator;
          this.displayedColumns = f[this.data.key].displayedColumns;
          this.dataSource.sort = this.sort;
        }
      });
    });
  }
  callOnChange(key: string, value: string) {
    this.params = this.params.set(key, value);
    this.getData();
  }
}
