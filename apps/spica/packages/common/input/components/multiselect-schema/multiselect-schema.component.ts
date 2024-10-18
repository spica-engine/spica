import {Component, Inject} from "@angular/core";
import {INPUT_SCHEMA} from "../../input";
import {InputResolver} from "../../input.resolver";
import {SchemaComponent} from "../schema.component";

@Component({
  selector: "multiselect-schema",
  templateUrl: "./multiselect-schema.component.html",
  styleUrls: ["./multiselect-schema.component.scss"]
})
export class MultiselectSchemaComponent extends SchemaComponent {
  availableTypes = ["string", "number"];

  constructor(@Inject(INPUT_SCHEMA) public schema: any, private resolver: InputResolver) {
    super(schema);
    this.schema.items = this.schema.items || {type: "string"};
  }

  // we need to change whole items object in order to notify enum-schema component from changes
  onTypeChange(value: string) {
    this.schema.items = {
      type: value
    };
  }
}
