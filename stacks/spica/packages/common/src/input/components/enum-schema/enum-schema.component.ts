import {Component, Inject, OnDestroy} from "@angular/core";
import {INPUT_SCHEMA, InputSchema} from "../../input";

@Component({
  templateUrl: "./enum-schema.component.html",
  selector: "enum-schema",
  styleUrls: ["./enum-schema.component.scss"]
})
export class EnumSchemaComponent implements OnDestroy {
  _trackBy: (i) => any = i => i;

  schemaWithoutEnum: InputSchema;

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    this.schema.enum = this.schema.enum || [];
    this.schemaWithoutEnum = {...this.schema, enum: undefined};
  }

  addItem() {
    this.schema.enum.push("");
  }

  removeItem(index) {
    this.schema.enum.splice(index, 1);
  }

  ngOnDestroy() {
    delete this.schema.enum;
  }
}
