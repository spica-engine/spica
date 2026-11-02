import {Keyword} from "@spica-server/interface-core";

type Property = {
  type?: string;
  options?: {translate?: boolean};
  properties?: Record<string, Property>;
  items?: Property | Property[];
};

const hasOwn = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

const isStructuredObject = (property: Property) =>
  property.type == "object" && Boolean(property.properties);

function itemObject(property: Property): Property | undefined {
  const items = property.items;
  const isArray = property.type == "array" || property.type == "multiselect";
  return isArray && items && !Array.isArray(items) && isStructuredObject(items) ? items : undefined;
}

function resolve(properties: Record<string, Property> | undefined, path: string[]) {
  let current = properties;
  let translated = false;
  for (const [position, segment] of path.entries()) {
    if (!current || typeof current != "object" || !hasOwn(current, segment)) {
      return {translated};
    }
    const property = current[segment];
    translated ||= Boolean(property.options?.translate);
    if (position == path.length - 1) {
      const holdsColumns = isStructuredObject(property) || itemObject(property);
      return {property: holdsColumns ? undefined : property, translated};
    }
    current = isStructuredObject(property) ? property.properties : itemObject(property)?.properties;
  }
  return {translated};
}

export function indexProblems(bucket: {
  properties?: Record<string, Property>;
  indexes?: {definition?: Record<string, unknown>}[];
}): string[] {
  const problems: string[] = [];
  for (const index of Array.isArray(bucket.indexes) ? bucket.indexes : []) {
    const definition = index?.definition ?? {};
    const label = JSON.stringify(definition);
    for (const [field, direction] of Object.entries(definition)) {
      const {property, translated} = resolve(bucket.properties, field.split("."));
      if (translated) {
        problems.push(
          `Index ${label} refers to "${field}", and indexes on translated properties are not supported on PostgreSQL yet.`
        );
      } else if (!property) {
        problems.push(
          `Index ${label} refers to "${field}", which is not a property of the bucket.`
        );
      } else if (direction === "2dsphere" && property.type != "location") {
        problems.push(`Index ${label} cannot use 2dsphere on "${field}", which is not a location.`);
      } else if (direction !== "2dsphere" && property.type == "location") {
        problems.push(`Index ${label} can only index the location "${field}" with 2dsphere.`);
      }
    }
  }
  return problems;
}

export const bucketIndexesKeyword: Keyword = {
  keyword: "bucketIndexes",
  type: "object",
  schemaType: "boolean",
  errors: true,
  validate: function validate(schema: boolean, data: any) {
    if (!schema) {
      return true;
    }
    const problems = indexProblems(data);
    (validate as any).errors = problems.map(message => ({
      keyword: "bucketIndexes",
      message,
      params: {}
    }));
    return problems.length == 0;
  }
};
