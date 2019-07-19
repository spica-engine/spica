import {HttpEventType} from "@angular/common/http";
import {Component, OnInit, ViewChild} from "@angular/core";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";

@Component({
  selector: "storage-picker",
  templateUrl: "./picker.component.html",
  styleUrls: ["./picker.component.scss"]
})
export class PickerComponent implements OnInit {
  selected: Storage;
  storages$: Observable<Storage[]>;
  progress: number;
  refresh: Subject<void> = new Subject<void>();
  incomingFile: FileList;

  @ViewChild(MatPaginator, {static: true}) private _paginator: MatPaginator;

  _pageSize: number = 8;
  _onChange: Subject<Storage> = new Subject<Storage>();

  readonly onChange = this._onChange.asObservable();

  constructor(private storage: StorageService) {}

  ngOnInit(): void {
    this.storages$ = merge(this._paginator.page, of(null)).pipe(
      switchMap(() =>
        this.storage.getAll(
          this._paginator.pageSize || this._pageSize,
          this._paginator.pageSize * this._paginator.pageIndex
        )
      ),
      map(storage => {
        this._paginator.length =
          typeof storage.meta === "undefined" || typeof storage.meta.total === "undefined"
            ? 0
            : storage.meta.total;
        return storage.data;
      })
    );
  }
  uploadStorage(file: FileList): void {
    if (file) {
      this.storage.insertMany(file).subscribe(
        response => {
          if (response.type === HttpEventType.UploadProgress) {
            this.progress = Math.round((100 * response.loaded) / response.total);
          } else if (response.type === HttpEventType.Response) {
            this.selected = response.body[0];
            this.selected.url = response.url + "/" + response.body[0]._id;
            this._onChange.next(this.selected);
            this.progress = undefined;
            this.refresh.next();
          }
        },
        () => {
          this.progress = undefined;
          this.refresh.next();
        }
      );
    }
  }
}
