import {HttpEventType} from "@angular/common/http";
import {Component, forwardRef, HostListener, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {InputSchema, INPUT_OPTIONS, INPUT_SCHEMA} from "@spica-client/common";
import {Subject} from "rxjs";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";

@Component({
  selector: "storage",
  templateUrl: "./storage.component.html",
  styleUrls: ["./storage.component.scss"],
  viewProviders: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StorageComponent)
    }
  ]
})
export class StorageComponent implements ControlValueAccessor {
  onChangeFn: any;
  onTouchedFn: any;
  value: string;
  incomingFile: FileList;
  disabled: boolean;
  storageStyle: string;
  selected: Storage;
  progress: number;
  _onChange: Subject<string> = new Subject<string>();
  _pageSize: number = 8;
  refresh: Subject<void> = new Subject<void>();

  constructor(
    @Inject(INPUT_SCHEMA) public readonly schema: InputSchema,
    @Inject(INPUT_OPTIONS) public options,
    private storage: StorageService
  ) {
    this.storageStyle =
      typeof this.options.storageStyle === "undefined" ? "large" : this.options.storageStyle;
  }

  @HostListener("click")
  callOnTouched(): void {
    if (this.onTouchedFn) {
      this.onTouchedFn();
    }
  }

  callOnChange() {
    this.value = this.selected.url;
    if (this.onChangeFn) {
      this.onChangeFn(this.value);
    }
  }

  writeValue(value: string): void {
    this.value = value;
    if (value) {
      const storageId = this.value.substring(this.value.lastIndexOf("/") + 1);
      this.storage
        .getOne(storageId)
        .toPromise()
        .then(data => (this.selected = data));
    } else {
      this.selected = undefined;
    }
  }
  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }
  delete() {
    this.value = "";
    this.selected = undefined;
    this.onChangeFn();
  }
  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
  uploadStorage(file: FileList): void {
    if (file) {
      this.storage.insertMany(file).subscribe(
        event => {
          if (event.type === HttpEventType.UploadProgress) {
            this.progress = Math.round((100 * event.loaded) / event.total);
          } else if (event.type === HttpEventType.Response) {
            this.selected = {
              content: event.body[0].content,
              name: event.body[0].name,
              _id: event.body[0]._id,
              url: event.url + "/" + event.body[0]._id
            };
            this.callOnChange();
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
