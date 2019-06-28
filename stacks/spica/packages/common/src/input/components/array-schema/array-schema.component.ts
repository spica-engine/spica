import {Component, Inject} from "@angular/core";

import {EMPTY_INPUT_SCHEMA, INPUT_SCHEMA, InputSchema} from "../../input";

@Component({
  templateUrl: "./array-schema.component.html",
  styleUrls: ["./array-schema.component.scss"]
})
export class ArraySchemaComponent {
  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    this.schema.items = this.schema.items || {...EMPTY_INPUT_SCHEMA};
  }
}
