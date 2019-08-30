import {Component, Inject} from "@angular/core";

import {INPUT_SCHEMA, InputSchema} from "../../input";

@Component({
  templateUrl: "./string-schema.component.html",
  styleUrls: ["./string-schema.component.scss"]
})
export class StringSchemaComponent {
  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {}
  removeEnum() {
    delete this.schema.enum;
  }
}
