import {Component, ElementRef, Inject, ViewChild} from "@angular/core";
import {FormControl} from "@angular/forms";
import {MatChipInputEvent} from "@angular/material/chips";
import {InputSchema, INPUT_SCHEMA} from "../../input";
import {COMMA, ENTER} from "@angular/cdk/keycodes";

@Component({
  templateUrl: "./enum-schema.component.html",
  selector: "enum-schema",
  styleUrls: ["./enum-schema.component.scss"]
})
export class EnumSchemaComponent {
  _trackBy: (i) => any = i => i;
  enumCtrl = new FormControl();
  selectable = true;
  removable = true;
  separatorKeysCodes: number[] = [ENTER, COMMA];

  schemaWithoutEnum: InputSchema;
  @ViewChild("enumInput") enumInput: ElementRef<HTMLInputElement>;

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    this.schema.enum = this.schema.enum || [];
    this.schemaWithoutEnum = {...this.schema, enum: undefined};
  }

  addItem(event: MatChipInputEvent) {
    const input = event.input;
    const value = event.value;

    // Add our fruit
    if ((value || "").trim()) {
      this.schema.enum.push(value.trim());
    }

    // Reset the input value
    if (input) {
      input.value = "";
    }

    this.enumCtrl.setValue(null);
  }

  removeItem(index) {
    this.schema.enum.splice(index, 1);
    if (this.schema.enum.length < 1) {
      delete this.schema.enum;
    }
  }
}
