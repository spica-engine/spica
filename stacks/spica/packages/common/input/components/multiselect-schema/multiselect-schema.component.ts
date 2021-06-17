import {Component, Inject} from "@angular/core";
import {DEFAULT_ARRAY_ITEM, InputSchema, INPUT_SCHEMA} from "../../input";
import {InputResolver} from "../../input.resolver";
import {SchemaComponent} from "../schema.component";

@Component({
  selector: "multiselect-schema",
  templateUrl: "./multiselect-schema.component.html",
  styleUrls: ["./multiselect-schema.component.scss"]
})
export class MultiselectSchemaComponent extends SchemaComponent {
  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema, private resolver: InputResolver) {
    super(schema);
    this.schema.items = this.schema.items || DEFAULT_ARRAY_ITEM;
  }
}
