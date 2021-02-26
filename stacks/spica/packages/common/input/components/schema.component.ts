export class SchemaComponent {
  schema: object = {};

  constructor(schema: object) {
    this.schema = schema;
  }

  onChange(value: string | number | boolean, field: string) {
    if (value === null || value === undefined || (typeof value == "string" && !value.length)) {
      delete this.schema[field];
    } else {
      this.schema[field] = value;
    }
  }
}
