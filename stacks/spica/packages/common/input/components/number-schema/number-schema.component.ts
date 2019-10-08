import {Component, Inject} from "@angular/core";
import {INPUT_SCHEMA, InputSchema} from "../../input";

@Component({
  templateUrl: "./number-schema.component.html",
  styleUrls: ["./number-schema.component.scss"]
})
export class NumberSchemaComponent {
  showOptions: boolean = false;

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {}

  removeEnum() {
    delete this.schema.enum;
  }
}
