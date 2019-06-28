import {Component, forwardRef, HostListener, Inject, ViewChild} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {INPUT_SCHEMA, InputSchema} from "@spica-client/common";

import {PickerDirective} from "../../../storage/components/picker/picker.directive";

@Component({
  template: `
    <text-editor [(ngModel)]="value" (ngModelChange)="this.onChange()"></text-editor>
  `,
  styleUrls: ["./richtext.scss"],
  viewProviders: [
    {provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditorComponent)}
  ]
})
export class RichTextEditorComponent implements ControlValueAccessor {
  value: string;
  disabled = false;
  fullscreen = false;

  @ViewChild(PickerDirective, {static: true}) picker: PickerDirective;
  onTouchedFn: () => void;
  onChangeFn: (value: string) => void;

  constructor(@Inject(INPUT_SCHEMA) public readonly schema: InputSchema) {}

  onChange(): void {
    if (this.onChangeFn) {
      this.onChangeFn(this.value);
    }
  }

  @HostListener("click")
  onTouch(): void {
    if (this.onTouchedFn) {
      this.onTouchedFn();
    }
  }

  writeValue(value: string): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
