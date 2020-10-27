import {Component, Inject} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {AddFieldModalComponent} from "@spica-client/bucket/pages/add-field-modal/add-field-modal.component";
import {InputPlacerWithMetaPlacer, InputSchema, INPUT_SCHEMA} from "../../input";
import {InputResolver} from "../../input.resolver";

@Component({
  templateUrl: "./object-schema.component.html",
  styleUrls: ["./object-schema.component.scss"]
})
export class ObjectSchemaComponent {
  systemFields: InputPlacerWithMetaPlacer[] = [];

  constructor(
    public _inputResolver: InputResolver,
    @Inject(INPUT_SCHEMA) public schema: InputSchema,
    private dialog: MatDialog
  ) {
    this.schema.properties = this.schema.properties || {};
  }

  createNewField(parentSchema: any, propertyKey: string = null) {
    let dialogRef = this.dialog.open(AddFieldModalComponent, {
      width: "800px",
      maxHeight: "800px",
      data: {
        parentSchema: parentSchema,
        propertyKey: propertyKey
      }
    });
  }

  removeProperty(name: string) {
    delete this.schema.properties[name];
    if (this.schema.required && this.schema.required.includes(name)) {
      this.schema.required = this.schema.required.filter(req => req != name);
    }
  }
}
