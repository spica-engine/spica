import {Component, Inject} from "@angular/core";
import {getDefaultArrayItems, InputSchema, INPUT_SCHEMA} from "../../input";
import {InputResolver} from "../../input.resolver";
import {SchemaComponent} from "../schema.component";

@Component({
  templateUrl: "./array-schema.component.html",
  styleUrls: ["./array-schema.component.scss"]
})
export class ArraySchemaComponent extends SchemaComponent {
  public origin: string;

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema, private resolver: InputResolver) {
    super(schema);
    this.schema.items = this.schema.items || getDefaultArrayItems();
    this.getOrigin();
  }

  getOrigin(): void {
    this.origin = this.resolver.getOriginByType(this.schema.items["type"]);
  }
}
