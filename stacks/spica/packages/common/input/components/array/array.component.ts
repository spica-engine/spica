import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {Component, forwardRef, Inject, ViewChild, ElementRef} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR, NgModel} from "@angular/forms";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";
import {InputResolver} from "../../input.resolver";

@Component({
  templateUrl: "./array.component.html",
  styleUrls: ["./array.component.scss"],
  viewProviders: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => ArrayComponent)}
  ]
})
export class ArrayComponent implements ControlValueAccessor {
  _values = new Array<any>();
  _disabled: boolean = false;
  _onChangeFn: Function = () => {};
  _onTouchedFn: Function = () => {};
  _activeIndex: number;

  @ViewChild("currentInput") currentInput: NgModel;

  constructor(
    @Inject(INPUT_SCHEMA) public schema: InternalPropertySchema,
    private resolver: InputResolver
  ) {}

  addItem() {
    this._values.push(this.resolver.coerce(this.schema.items["type"]));
    this._activeIndex = this._values.length - 1;
    this.callOnChange();

    setTimeout(() => this.currentInput.control.reset(), 1);
  }

  removeItem() {
    this._values.splice(this._activeIndex, 1);
    this._activeIndex =
      this._activeIndex - 1 == -1
        ? this._values.length > 0
          ? this._activeIndex
          : undefined
        : this._activeIndex - 1;

    this.callOnChange();
  }

  callOnChange() {
    this._onChangeFn(this._values);
  }

  writeValue(val: any): void {
    if (val && Array.isArray(val)) {
      this._values = val;
      this._activeIndex = this._values.length > 0 ? 0 : undefined;
    } else {
      this._values = [];
    }
  }

  registerOnChange(fn: any): void {
    this._onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled = isDisabled;
  }

  move(event: CdkDragDrop<string[]>) {
    moveItemInArray(this._values, event.previousIndex, event.currentIndex);
  }
}
