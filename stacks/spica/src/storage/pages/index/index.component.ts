import {BreakpointObserver, Breakpoints, BreakpointState} from "@angular/cdk/layout";
import {HttpEventType} from "@angular/common/http";
import {Component, OnInit, ViewChild} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, BehaviorSubject, Subject, of} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
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

  updates: Map<string, number> = new Map<string, number>();

  refresh: Subject<string> = new Subject();
  sorter: any = {_id: -1};
  cols: number = 5;

  loading$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  lastUpdates: Map<string, number> = new Map();

  isEmpty = true;

  selectedStorageIds = [];

  selectionActive = false;

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

  selectAll(storages: Storage[]) {
    this.selectedStorageIds = storages.map(storage => storage._id);
  }

  ngOnInit(): void {
    this.storages$ = merge(this.paginator.page, of(null), this.refresh).pipe(
      tap(() => this.loading$.next(true)),
      switchMap(() =>
        this.storage.getAll(
          this.paginator.pageSize || this.cols * 3,
          this.paginator.pageSize * this.paginator.pageIndex,
          this.sorter
        )
      ),
      map(storages => {
        this.paginator.length = 0;
        if (storages.meta && storages.meta.total) {
          this.paginator.length = storages.meta.total;
        }
        this.isEmpty = !storages.meta.total;
        return storages.data;
      }),
      tap(() => this.loading$.next(false))
    );
  }

  uploadStorageMany(file: FileList): void {
    if (file.length) {
      this.storage.insertMany(file).subscribe(
        event => {
          if (event.type === HttpEventType.UploadProgress) {
            this.progress = Math.round((100 * event.loaded) / event.total);
          } else if (event.type === HttpEventType.Response) {
            this.progress = undefined;
            this.refresh.next();
          }
        },
        err => {
          console.error(err);
          this.progress = undefined;
        }
      );
    }
  }

  updateStorage(storage: Storage, file: File) {
    if (file) {
      this.updates.set(storage._id, 0);
      storage.name = file.name;
      this.storage.updateOne(storage, file).subscribe(
        event => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = Math.round((100 * event.loaded) / event.total);
            this.updates.set(storage._id, progress);
          } else if (event.type === HttpEventType.Response) {
            this.updates.delete(storage._id);
            this.refresh.next();
          }
        },
        err => {
          console.error(err);
          this.updates.delete(storage._id);
        },
        () => this.updates.delete(storage._id)
      );
    }
  }

  clearLastUpdates() {
    this.lastUpdates.clear();
    this.refresh.next();
  }

  delete(id: string): void {
    this.storage
      .delete(id)
      .toPromise()
      .catch()
      .then(() => this.refresh.next());
  }

  deleteMany() {
    const promises = this.selectedStorageIds.map(id => this.storage.delete(id).toPromise());
    return Promise.all(promises).then(() => this.refresh.next());
  }

  sortStorage(value) {
    value.direction = value.direction === "asc" ? 1 : -1;
    this.sorter = {[value.name]: value.direction};
    this.refresh.next();
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
      .then(() => this.refresh.next());
  }

  addFolder(name: string) {
    const folder = new File([], name);
    this.storage.insertMany([folder] as any).toPromise();
  }
}
