import {Component, Inject} from "@angular/core";
import {InputSchema, INPUT_SCHEMA} from "../../input";

@Component({
  templateUrl: "./enum-schema.component.html",
  selector: "enum-schema",
  styleUrls: ["./enum-schema.component.scss"]
})
export class EnumSchemaComponent {
  _trackBy: (i) => any = i => i;

  schemaWithoutEnum: InputSchema;

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    this.schema.enum = this.schema.enum || [];
    this.schemaWithoutEnum = {...this.schema, enum: undefined};
  }

  addItem() {
    this.schema.enum.push(undefined);
  }

  removeItem(index) {
    this.schema.enum.splice(index, 1);
    if (this.schema.enum.length < 1) {
      delete this.schema.enum;
    }
  }
}
