import {Component, forwardRef, HostListener, Inject, ViewChild} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";
import {InputResolver} from "../../input.resolver";
import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
@Component({
  templateUrl: "./array.component.html",
  styleUrls: ["./array.component.scss"],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ArrayComponent)}]
})
export class ArrayComponent implements ControlValueAccessor {
  _values = new Array<any>();
  _disabled: boolean = false;
  _onChangeFn: any;
  _onTouchedFn: any;
  _activeIndex: number;

  @ViewChild("arrayForm", {static: true}) form;

  constructor(
    @Inject(INPUT_SCHEMA) public schema: InternalPropertySchema,
    private resolver: InputResolver
  ) {}

  addItem() {
    this._values.push(this.resolver.coerce(this.schema.items["type"]));
    this._activeIndex = this._values.length - 1;
    this.callOnChange();
  }

  removeItem() {
    this._values.splice(this._activeIndex, 1);
    this.callOnChange();
    setTimeout(
      () =>
        (this._activeIndex =
          this._activeIndex - 1 == -1
            ? this._values.length > 0
              ? this._activeIndex
              : undefined
            : this._activeIndex - 1)
    );
  }

  @HostListener("click")
  callOnTouched(): void {
    if (this._onTouchedFn) {
      this._onTouchedFn();
    }
  }

  callOnChange() {
    if (this._onChangeFn) {
      this._onChangeFn(this._values);
    }
  }

  writeValue(val: any): void {
    if (val && Array.isArray(val)) {
      this._values = val;
      this._activeIndex = this._values.length > 0 ? 0 : undefined;
    }
    if (!this._values.length) {
      this.addItem();
    }
  }

  registerOnChange(fn: any): void {
    this._onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedFn = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this._disabled = isDisabled;
  }

  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this._values, event.previousIndex, event.currentIndex);
  }
}
