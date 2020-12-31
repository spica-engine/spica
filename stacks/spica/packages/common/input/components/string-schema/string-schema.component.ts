import {Component, Inject} from "@angular/core";
import {INPUT_SCHEMA, InputSchema} from "../../input";
import {SchemaComponent} from "../schema.component";

@Component({
  templateUrl: "./string-schema.component.html",
  styleUrls: ["./string-schema.component.scss"]
})
export class StringSchemaComponent extends SchemaComponent {
  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    super(schema);
  }
  removeEnum() {
    delete this.schema.enum;
  }
  removePattern() {
    delete this.schema.pattern;
  }
}
