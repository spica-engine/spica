import {Component, Inject, OnDestroy} from "@angular/core";

import {INPUT_SCHEMA, InputSchema} from "../../input";

@Component({
  templateUrl: "./enum-schema.component.html",
  selector: "enum-schema",
  styleUrls: ["./enum-schema.component.scss"]
})
export class EnumSchemaComponent implements OnDestroy {
  _trackBy: (i) => any = i => i;
  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    this.schema.enum = this.schema.enum || [];
  }

  get schemaWithoutEnum(): InputSchema {
    const schemaClone = {...this.schema};
    delete schemaClone.enum;
    return schemaClone;
  }

  addItem() {
    this.schema.enum.push("");
  }

  removeItem(index) {
    this.schema.enum.splice(index, 1);
  }

  ngOnDestroy() {
    delete this.schema.enum;
  }
}
