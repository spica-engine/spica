import {Component, forwardRef, Input} from "@angular/core";
import {
  AbstractControl,
  AsyncValidator,
  ControlValueAccessor,
  NG_ASYNC_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors
} from "@angular/forms";

@Component({
  selector: "app-image-picker",
  templateUrl: "./image-picker.component.html",
  styleUrls: ["./image-picker.component.scss"],
  providers: [
    {provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ImagePickerComponent), multi: true},
    {provide: NG_ASYNC_VALIDATORS, useExisting: forwardRef(() => ImagePickerComponent), multi: true}
  ],
  host: {"(click)": "onTouched()"}
})
export class ImagePickerComponent implements ControlValueAccessor, AsyncValidator {
  @Input() size: number = 307200;
  @Input() width: number = 500;
  @Input() height: number = 500;

  public image: string;
  private onChanged = (obj: any) => {};
  public onTouched = () => {};

  preview(event: Event) {
    const [file] = event.srcElement["files"];
    if (file) {
      const reader = new FileReader();
      reader.onload = _event => {
        this.image = URL.createObjectURL(new Blob([<ArrayBuffer>reader.result], {type: file.type}));

        this.onChanged(reader.result);
      };
      reader.readAsArrayBuffer(file);
    }
  }

  writeValue(obj: any): void {
    this.image = obj;
  }

  registerOnChange(fn: any): void {
    this.onChanged = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {}

  registerOnValidatorChange?(fn: () => void): void {}

  validate(control: AbstractControl): Promise<ValidationErrors> {
    return new Promise(resolve => {
      if (!control.value) {
        return resolve(null);
      }
      const errors: any = {};

      if (control.value.length > this.size) {
        errors.size = {expected: this.size, actual: control.value.length};
      }
      const i = new Image();
      i.onload = () => {
        if (i.width != this.width) {
          errors.width = {expected: this.width, actual: i.width};
        }
        if (i.height != this.height) {
          errors.height = {expected: this.height, actual: i.height};
        }
        resolve(Object.keys(errors).length ? errors : null);
      };
      i.onerror = () => resolve(Object.keys(errors).length ? errors : null);
      i.src = this.image;
    });
  }
}
