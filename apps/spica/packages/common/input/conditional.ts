import {Pipe, PipeTransform, KeyValueDiffer, KeyValueDiffers, KeyValueChanges} from "@angular/core";
import {JSONSchema7, JSONSchema7Definition} from "json-schema";

function match(value: unknown, def: JSONSchema7Definition) {
  if (typeof def == "boolean") {
    return true;
  }
  return def.const == value;
}

@Pipe({
  name: "conditionalSchema",
  pure: false
})
export class ConditionalSchemaPipe implements PipeTransform {
  private dataDiffer: KeyValueDiffer<any, any>;
  private schemaDiffer: KeyValueDiffer<any, any>;

  private lastSchema: JSONSchema7;

  constructor(private differs: KeyValueDiffers) {}

  transform(schema: JSONSchema7, data: unknown) {
    if (!schema || !data) {
      return schema;
    }

    if (!this.schemaDiffer) {
      this.schemaDiffer = this.differs.find(schema).create();
    }

    if (!this.dataDiffer) {
      this.dataDiffer = this.differs.find(data).create();
    }

    const schemaChanges: KeyValueChanges<string, JSONSchema7> | null =
      this.schemaDiffer.diff(schema);
    const dataChanges: KeyValueChanges<string, unknown> | null = this.dataDiffer.diff(data);

    if (!schemaChanges && !dataChanges) {
      return this.lastSchema;
    }

    const _if = schema.if;
    const _then = schema.then;
    const _else = schema.else;

    if (
      typeof _if == "object" &&
      _if.properties &&
      typeof _then == "object" &&
      _then.properties &&
      typeof _else == "object" &&
      _else.properties
    ) {
      const matches = Object.entries(_if.properties).every(([key, definiton]) =>
        match(data ? data[key] : undefined, definiton)
      );

      if (matches) {
        schema = {
          ...schema,
          properties: {
            ...schema.properties,
            ..._then.properties
          }
        };
      } else {
        schema = {
          ...schema,
          properties: {
            ...schema.properties,
            ..._else.properties
          }
        };
      }
    }

    return (this.lastSchema = schema);
  }
}
