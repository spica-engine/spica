import {Component, Inject} from "@angular/core";
import {INPUT_SCHEMA, InputSchema} from "../../input";
import {PredefinedOptionLoader} from "../../input-schema-placer/predefineds/interface";
import {SchemaComponent} from "../schema.component";
import {STRING_PREDEFINED_OPTION_LOADER} from "./predefineds";

@Component({
  templateUrl: "./string-schema.component.html",
  styleUrls: ["./string-schema.component.scss"]
})
export class StringSchemaComponent extends SchemaComponent {
  constructor(
    @Inject(INPUT_SCHEMA) public schema: InputSchema,
    @Inject(STRING_PREDEFINED_OPTION_LOADER) public loader: PredefinedOptionLoader<string>
  ) {
    super(schema);
  }
  removeEnum() {
    delete this.schema.enum;
  }
  removePattern() {
    delete this.schema.pattern;
  }
}
