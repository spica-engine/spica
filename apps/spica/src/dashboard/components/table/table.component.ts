import {
  Component,
  Input,
  ViewChild,
  Output,
  EventEmitter,
  AfterViewInit,
  OnChanges,
  SimpleChanges
} from "@angular/core";
import {MatSort} from "@angular/material/sort";
import {MatLegacyTableDataSource as MatTableDataSource} from "@angular/material/legacy-table";
import {MatPaginator} from "@angular/material/paginator";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {isSmallComponent, Ratio} from "@spica-client/dashboard/interfaces";

@Component({
  selector: "dashboard-table",
  templateUrl: "./table.component.html",
  styleUrls: ["./table.component.scss"]
})
export class TableComponent implements AfterViewInit, OnChanges {
  @Input() componentData$: Observable<any>;

  // we can not cover mat table with ngif
  // otherwise mat-sort won't work
  displayedColumns = [];

  @Input() ratio: Ratio;
  @Input() refresh: boolean;

  isSmall = false;

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  @Output() isHovered = new EventEmitter<boolean>();

  public showTable = false;

  dataSource: MatTableDataSource<Object[]>;
  @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: false}) sort: MatSort;

  pageSizeOptions = [3, 15, 50];
  pageSize = 15;

  ngAfterViewInit() {
    this.componentData$ = this.componentData$.pipe(
      tap(componentData => {
        this.displayedColumns = componentData.displayedColumns;

        this.dataSource = new MatTableDataSource(componentData.data);

        this.dataSource.sort = this.sort;

        this.setPageSizeOptions();
      })
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    this.isSmall = isSmallComponent(this.ratio);
    if (this.paginator) {
      this.setPageSizeOptions();
    }
  }

  setPageSizeOptions() {
    if (this.isSmall) {
      this.paginator.pageSize = this.pageSize;
      this.paginator.pageSizeOptions = this.pageSizeOptions;
    } else if (this.isMedium()) {
      this.paginator.pageSize = 3;
      this.paginator.pageSizeOptions = [3];
    } else {
      this.paginator.pageSize = 15;
      this.paginator.pageSizeOptions = [15];
    }

    this.dataSource.paginator = this.paginator;
  }

  isMedium() {
    return this.ratio == Ratio.TwoByTwo || this.ratio == Ratio.FourByTwo;
  }

  onShowTableClicked() {
    this.showTable = !this.showTable;
    this.isHovered.emit(this.showTable);
  }
}
