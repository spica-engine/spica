import {Component, OnInit, ViewChild} from "@angular/core";
import {MatDialogRef} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {Filters} from "@spica-client/storage/helpers";
import {BehaviorSubject, merge, Observable} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../services/storage.service";

@Component({
  selector: "storage-picker",
  templateUrl: "./picker.component.html",
  styleUrls: ["./picker.component.scss"]
})
export class PickerComponent implements OnInit {
  storages$: Observable<Storage[]>;

  totalItems: number = 0;
  progress: number;
  refresh: BehaviorSubject<any> = new BehaviorSubject<any>("");
  incomingFile: FileList;

  @ViewChild(MatPaginator, {static: true}) private _paginator: MatPaginator;

  _pageSize: number = 8;

  sorter: any = {_id: -1};

  constructor(private storage: StorageService, private ref: MatDialogRef<PickerComponent>) {}

  ngOnInit(): void {
    this.storages$ = merge(this._paginator.page, this.refresh).pipe(
      switchMap(() =>
        this.storage.getAll({
          filter: Filters.ListOnlyObjects,
          limit: this._paginator.pageSize || this._pageSize,
          skip: this._paginator.pageSize * this._paginator.pageIndex,
          sort: this.sorter,
          paginate: true
        })
      ),
      map(storage => {
        this._paginator.length = storage.meta.total;
        this.totalItems = this._paginator.length;
        return storage.data;
      })
    );
  }

  sortStorage(value) {
    value.direction = value.direction === "asc" ? 1 : -1;
    this.sorter = {[value.name]: value.direction};
    this.refresh.next("");
  }

  close(storage: Storage) {
    this.ref.close(storage);
  }
}
