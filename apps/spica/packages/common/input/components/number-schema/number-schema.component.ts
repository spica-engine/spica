import {Component, Inject} from "@angular/core";
import {INPUT_SCHEMA, InputSchema} from "../../input";
import {SchemaComponent} from "../schema.component";

@Component({
  templateUrl: "./number-schema.component.html",
  styleUrls: ["./number-schema.component.scss"]
})
export class NumberSchemaComponent extends SchemaComponent {
  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    super(schema);
  }
  removeEnum() {
    delete this.schema.enum;
  }
}
