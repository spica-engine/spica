import {Component, Inject} from "@angular/core";
import {InputSchema, INPUT_SCHEMA} from "../../input";
@Component({
  selector: "app-boolean-schema",
  templateUrl: "./boolean-schema.component.html",
  styleUrls: ["./boolean-schema.component.scss"]
})
export class BooleanSchemaComponent {
  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    schema.default = schema.default != undefined ? schema.default : false;
  }
}
