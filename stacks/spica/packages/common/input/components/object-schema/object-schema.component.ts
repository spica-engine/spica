import {Component, Inject} from "@angular/core";
import {InputSchema, INPUT_SCHEMA} from "../../input";

@Component({
  templateUrl: "./object-schema.component.html",
  styleUrls: ["./object-schema.component.scss"]
})
export class ObjectSchemaComponent {
  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    this.schema.properties = this.schema.properties || {};
  }

  addProperty(propertyName: string): void {
    propertyName = propertyName.toLowerCase();
    if (propertyName && !this.schema.properties[propertyName]) {
      this.schema.properties[propertyName] = {
        type: "string",
        title: propertyName,
        description: `Description of '${propertyName}'`
      };
    }
  }

  toggleRequired(key: string, required: boolean) {
    this.schema.required = this.schema.required || [];
    required
      ? this.schema.required.push(key)
      : this.schema.required.splice(this.schema.required.indexOf(key), 1);
  }

  removeProperty(name: string) {
    delete this.schema.properties[name];
  }
}
