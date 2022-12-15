import { HttpEventType } from "@angular/common/http";
import { Component, forwardRef, HostListener, Inject } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { INPUT_SCHEMA, InternalPropertySchema } from "@spica-client/common";
import { Observable } from "rxjs";
import { map, share } from "rxjs/operators";
import { Storage } from "../../interfaces/storage";
import { StorageService } from "../../storage.service";
import { StorageDialogOverviewDialog } from "../storage-dialog-overview/storage-dialog-overview";

@Component({
  selector: "storage",
  templateUrl: "./storage.component.html",
  styleUrls: ["./storage.component.scss"],
  viewProviders: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => StorageComponent)
    }
  ],
  host: {
    "[class.disabled]": "disabled",
    "(click)": "onTouchedFn()"
  }
})
export class StorageComponent implements ControlValueAccessor {
  disabled: boolean;

  progress$: Observable<number>;

  isDraggingOver: boolean = false;

  blob: Blob | Storage;
  value: string;

  onChangeFn: (val: string) => void = () => { };
  onTouchedFn: () => void = () => { };

  constructor(
    @Inject(INPUT_SCHEMA) public readonly schema: InternalPropertySchema,
    private storage: StorageService,
    private dialog: MatDialog
  ) { }

  @HostListener("drop", ["$event"])
  uploadStorage(e: DragEvent): void {
    e.preventDefault();
    this.isDraggingOver = false;
    const files = e.dataTransfer.files;

    if (files.length) {
      this.blob = files.item(0);
      this.progress$ = this.storage.insertMany(files).pipe(
        map(event => {
          if (event.type === HttpEventType.UploadProgress) {
            return Math.round((100 * event.loaded) / event.total);
          } else if (event.type === HttpEventType.Response) {
            this.value = event.body[0].url;
            this.onChangeFn(this.value);
            this.progress$ = undefined;
          }
        }),
        share()
      );
    }
  }

  @HostListener("dragover", ["$event"])
  dragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer.types.indexOf("Files") > -1) {
      e.dataTransfer.dropEffect = "copy";
      this.isDraggingOver = true;
    }
  }

  @HostListener("dragleave", ["$event"])
  dragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDraggingOver = false;
  }

  pickFromStorage(obj: Storage) {
    if (!obj) {
      return;
    }
    console.log("obj :", obj)

    this.blob = obj;
    this.value = obj.url;

    const pureUrl = this.storage.clearTimestamp(obj.url);
    this.onChangeFn(pureUrl);
  }

  writeValue(value: string): void {
    if (value) {
      const now = new Date().getTime().toString();
      value = this.storage.putTimestamp(value, now);
    }

    this.blob = undefined;
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(disabled: boolean) {
    this.disabled = disabled;
  }

  clear() {
    this.progress$ = undefined;
    this.value = this.blob = undefined;
    this.onChangeFn(this.value);
  }
  openPreview(storage: Storage): void {
    const pureUrl = this.storage.clearTimestamp((storage?.url || storage) as string);
    this.dialog.open(StorageDialogOverviewDialog, {
      maxWidth: "80%",
      maxHeight: "80%",
      panelClass: "preview-object",
      data: pureUrl
    });
  }
}
