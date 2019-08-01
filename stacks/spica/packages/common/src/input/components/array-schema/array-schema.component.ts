import {Component, Inject} from "@angular/core";
import {EMPTY_INPUT_SCHEMA, InputSchema, INPUT_SCHEMA} from "../../input";
import {InputResolver} from "../../input.resolver";

@Component({
  templateUrl: "./array-schema.component.html",
  styleUrls: ["./array-schema.component.scss"]
})
export class ArraySchemaComponent {
  public origin: string;

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema, private resolver: InputResolver) {
    this.schema.items = this.schema.items || {...EMPTY_INPUT_SCHEMA};
    this.getOrigin();
  }

  getOrigin(): void {
    this.origin = this.resolver.getOriginByType(this.schema.items["type"]);
  }
}
