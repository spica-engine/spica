import {Component, Input, ViewChild, Output, EventEmitter, AfterViewInit} from "@angular/core";
import {MatSort} from "@angular/material/sort";
import {MatTableDataSource} from "@angular/material/table";
import {MatPaginator} from "@angular/material/paginator";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import { isSmallComponent, Ratio } from "@spica-client/dashboard/interfaces";


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

   @Input() ratio: Ratio;

   isSmall = false;

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  @Output() isHovered = new EventEmitter<boolean>();

  public showTable = false;


  dataSource: MatTableDataSource<Object[]>;
  @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: false}) sort: MatSort;

  ngAfterViewInit() {
    this.isSmall = isSmallComponent(this.ratio)
    this.componentData$ = this.componentData$.pipe(
      tap(componentData => {
        this.displayedColumns = componentData.displayedColumns;

        console.log("columns", this.displayedColumns);
        
        
        this.dataSource = new MatTableDataSource(componentData.data);
        console.log("dataSouce", this.dataSource);

        this.dataSource.sort = this.sort;
        console.log("dataSource.sort", this.dataSource.sort);
        
        console.log("sort", this.sort);


        console.log("dataSource.paginator", this.dataSource.paginator);
        console.log("pageSize", this.dataSource.paginator.pageSizeOptions[2]);
        
        if(this.ratio == Ratio.TwoByTwo || this.ratio == Ratio.FourByTwo){
          this.paginator.pageSizeOptions = [3];
        }
        this.dataSource.paginator = this.paginator;

      })
    );
  }

  onShowTableClicked() {
    this.showTable = !this.showTable;
    this.isHovered.emit(this.showTable);
  }
}
