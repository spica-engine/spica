import {BreakpointObserver, Breakpoints, BreakpointState} from "@angular/cdk/layout";
import {HttpEventType} from "@angular/common/http";
import {Component, OnInit, ViewChild} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, of, BehaviorSubject} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {ImageEditorComponent} from "../../components/image-editor/image-editor.component";
import {StorageDialogOverviewDialog} from "../../components/storage-dialog-overview/storage-dialog-overview";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";

@Component({
  selector: "storage-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  storages$: Observable<Storage[]>;
  progress: number;
  refresh: BehaviorSubject<string> = new BehaviorSubject(undefined);
  sorter;
  cols: number = 4;

  isEmpty = true;

  constructor(
    private storage: StorageService,
    public breakpointObserver: BreakpointObserver,
    public dialog: MatDialog
  ) {
    this.breakpointObserver
      .observe([
        Breakpoints.XSmall,
        Breakpoints.XLarge,
        Breakpoints.Large,
        Breakpoints.Medium,
        Breakpoints.Small
      ])
      .subscribe((state: BreakpointState) => {
        this.breakpointObserver.isMatched(Breakpoints.XSmall)
          ? (this.cols = 2)
          : this.breakpointObserver.isMatched(Breakpoints.Small)
          ? (this.cols = 3)
          : this.breakpointObserver.isMatched(Breakpoints.Medium)
          ? (this.cols = 4)
          : (this.cols = 5);
      });
  }

  ngOnInit(): void {
    this.storages$ = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(updatedId =>
        this.storage
          .getAll(
            this.paginator.pageSize || 12,
            this.paginator.pageSize * this.paginator.pageIndex,
            this.sorter
          )
          .pipe(
            map(storages => {
              if (!updatedId) {
                return storages;
              }

              let index = storages.data.findIndex(s => s._id == updatedId);
              if (index != -1) {
                storages.data[index].url += "?timestamp=" + new Date().getTime();
              }

              return storages;
            })
          )
      ),
      map(storages => {
        this.paginator.length = 0;
        if (storages.meta && storages.meta.total) {
          this.paginator.length = storages.meta.total;
        }
        this.isEmpty = !storages.meta.total;
        return storages.data;
      })
    );
  }

  uploadStorageMany(file: FileList): void {
    if (file) {
      this.storage.insertMany(file).subscribe(
        event => {
          if (event.type === HttpEventType.UploadProgress) {
            this.progress = Math.round((100 * event.loaded) / event.total);
          } else if (event.type === HttpEventType.Response) {
            this.progress = undefined;
            this.refresh.next(undefined);
          }
        },
        () => this.uploadDone()
      );
    }
  }

  uploadDone() {
    this.sortStorage({direction: "desc", name: "_id"});
    this.progress = undefined;
    this.refresh.next(undefined);
  }

  delete(id: string): void {
    this.storage
      .delete(id)
      .toPromise()
      .catch()
      .then(() => this.refresh.next(undefined));
  }

  sortStorage({...value}) {
    value.direction = value.direction === "asc" ? 1 : -1;
    this.sorter = {};
    this.sorter[value.name] = value.direction;
    this.refresh.next(undefined);
  }

  openPreview(storage: Storage): void {
    this.dialog.open(StorageDialogOverviewDialog, {
      maxWidth: "80%",
      maxHeight: "80%",
      panelClass: "preview-object",
      data: storage
    });
  }

  openEdit(storage: Storage): void {
    this.dialog
      .open(ImageEditorComponent, {
        maxWidth: "80%",
        maxHeight: "80%",
        panelClass: "edit-object",
        data: storage
      })
      .afterClosed()
      .toPromise()
      .then(updatedId => this.refresh.next(updatedId));
  }
}
