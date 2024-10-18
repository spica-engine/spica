import {Bucket} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {GraphQLResolveInfo} from "graphql";

const locationTypes = ["Point"];

enum Prefix {
  Type = "type",
  Input = "input"
}

enum Suffix {
  Type = "",
  Input = "Input"
}

export interface SchemaWarning {
  target: string;
  reason: string;
}

export function validateBuckets(buckets: Bucket[]) {
  const warnings: SchemaWarning[] = [];
  for (const bucket of buckets) {
    validateProperties(
      bucket,
      getBucketName(bucket._id),
      buckets.map(bucket => bucket._id.toString()),
      warnings
    );
  }
  return {warnings, buckets};
}

function validateProperties(
  bucket: Bucket,
  baseName: string,
  bucketIds: string[],
  errors: SchemaWarning[]
) {
  for (const [key, definition] of Object.entries(bucket.properties)) {
    if (!validateName(key)) {
      errors.push({
        target: baseName + "." + key,
        reason:
          "Name specification must start with an alphabetic character and can not include any non-word character."
      });

      delete bucket.properties[key];
      bucket.properties[replaceName(key)] = getDefaultDefinition();

      if (bucket.required) {
        const requiredIndex = bucket.required.findIndex(field => field == key);
        if (requiredIndex != -1) {
          bucket.required.splice(requiredIndex, 1);
        }
      }

      // name and definition changed, skip the definition validation
      continue;
    }

    validateDefinition(definition, baseName + "." + key, bucketIds, errors);
  }
}

function validateDefinition(
  definition: any,
  name: string,
  bucketIds: string[],
  errors: SchemaWarning[]
) {
  if (definition.enum && !validateEnum(definition.enum)) {
    const reason = !definition.enum.length
      ? "Enum values must contain at least one item."
      : "Enum values must start with an alphabetic character and can not include any non-word character.";
    errors.push({
      target: name,
      reason: reason
    });

    delete definition.enum;
  }

  switch (definition.type) {
    case "array":
      validateDefinition(definition.items, `${name}_array`, bucketIds, errors);
      break;

    case "string":
      break;

    case "textarea":
      break;

    case "richtext":
      break;

    case "color":
      break;

    case "storage":
      break;

    case "object":
      validateProperties(definition as Bucket, name, bucketIds, errors);
      break;

    case "date":
      break;

    case "number":
      break;

    case "boolean":
      break;

    case "location":
      if (!isLocationTypeValid(definition.locationType)) {
        errors.push({
          target: name,
          reason: `Unknown location type '${definition.locationType}'.`
        });
        writeDefaultDefinition(definition);
      }
      break;

    case "relation":
      const reasons = [];
      if (!relationTypeValid(definition.relationType)) {
        reasons.push(`Relation type '${definition.relationType}' is invalid.`);
      }

      if (!relatedBucketExists(definition.bucketId, bucketIds)) {
        reasons.push(`Related bucket '${definition.bucketId}' does not exist.`);
      }

      if (reasons.length) {
        for (const reason of reasons) {
          errors.push({
            target: name,
            reason: reason
          });
        }

        writeDefaultDefinition(definition);
      }

      break;

    default:
      errors.push({
        target: name,
        reason: `Type '${definition.type}' is invalid type.`
      });
      writeDefaultDefinition(definition);
      break;
  }
}

export function createSchema(bucket: Bucket, staticTypes: string, bucketIds: string[]) {
  const name = getBucketName(bucket._id);
  let schema = `
      ${staticTypes}
      
      type ${name}FindResponse{
        meta: Meta
        data: [${name}]
      }

      type Query{
        Find${name}(limit: Int, skip: Int, sort: JSON, language: String, query: JSON): ${name}FindResponse
        FindBy${name}Id(_id: ObjectID!, language: String):${name}
      }

      type Mutation{
        insert${name}(input: ${name}Input): ${name}
        replace${name}(_id: ObjectID!, input: ${name}Input): ${name}
        patch${name}(_id: ObjectID!, input: JSON): ${name}
        delete${name}(_id: ObjectID!): String
      }
    `;

  const types = createInterface(Prefix.Type, Suffix.Type, name, bucket, [], bucketIds);

  const inputs = createInterface(Prefix.Input, Suffix.Input, name, bucket, [], bucketIds);

  schema += types + inputs;

  return schema;
}

function createInterface(
  prefix: string,
  suffix: string,
  name: string,
  schema: any,
  extras: string[],
  bucketIds: string[]
) {
  const properties = [];

  if (schema._id && prefix == Prefix.Type) {
    properties.push("_id: ObjectID");
  }

  for (const [key, value] of Object.entries(schema.properties)) {
    const isRequired = schema.required && schema.required.includes(key);

    const property = createProperty(
      name,
      prefix,
      suffix,
      key,
      value,
      isRequired,
      extras,
      bucketIds
    );

    properties.push(property);
  }

  const result =
    `
      ${prefix} ${name + suffix}{
        ${properties.join("\n")}
      }
    ` + extras.join("\n");

  return result;
}

function createEnum(name: string, values: string[]) {
  return `
      enum ${name}{
        ${Array.from(new Set(values).values()).join("\n")}
      }
    `;
}

function createProperty(
  name: string,
  prefix: string,
  suffix: string,
  key: string,
  value: any,
  isRequired: Boolean,
  extras: string[],
  bucketIds: string[]
) {
  return `${key}: ${createPropertyValue(
    name,
    prefix,
    suffix,
    key,
    value,
    isRequired,
    extras,
    bucketIds
  )}`;
}

function getDefaultDefinition() {
  return {
    type: "string"
  } as any;
}

function writeDefaultDefinition(definition: any) {
  for (const key of Object.keys(definition)) {
    delete definition[key];
  }
  definition.type = "string";
}

function validateName(name: string) {
  return /^[_A-Za-z][_0-9A-Za-z]*$/.test(name);
}

function replaceName(name: string) {
  name = /^[0-9]/.test(name) ? "_" + name : name;
  return name.replace(/[^_a-zA-Z0-9]/g, "_");
}

function validateEnum(values: string[]) {
  return values.length ? values.every(value => validateName(value)) : false;
}

function createPropertyValue(
  name: string,
  prefix: string,
  suffix: string,
  key: string,
  value: any,
  isRequired: Boolean,
  extras: string[],
  bucketIds: string[]
) {
  let result;

  if (value.enum) {
    if (prefix == Prefix.Type) {
      const extra = createEnum(`${name}_${key}`, value.enum);
      extras.push(extra);
    }

    return `${name}_${key}`;
  }

  switch (value.type) {
    case "array":
      result = `[${createPropertyValue(
        `${name}_array`,
        prefix,
        suffix,
        key,
        value.items,
        false,
        extras,
        bucketIds
      )}]`;
      break;

    case "string":
      result = "String";
      break;

    case "textarea":
      result = "String";
      break;

    case "richtext":
      result = "String";
      break;

    case "color":
      result = "String";
      break;

    case "storage":
      result = "String";
      break;

    case "object":
      const extra = createInterface(prefix, suffix, `${name}_${key}`, value, [], bucketIds);
      extras.push(extra);
      result = `${name}_${key}` + suffix;
      break;

    case "date":
      result = "Date";
      break;

    case "number":
      result = "Int";
      break;

    case "boolean":
      result = "Boolean";
      break;

    case "location":
      result = prefix == Prefix.Type ? "Location" : "LocationInput";

      result = value.locationType + result;

      break;

    case "relation":
      result = prefix == Prefix.Type ? getBucketName(value.bucketId) : "String";

      if (value.relationType == "onetomany") {
        result = `[${result}]`;
      }

      break;
  }

  if (isRequired && prefix == Prefix.Input) {
    result = result + "!";
  }

  return result;
}

function relatedBucketExists(bucketId: string, bucketIds: string[]) {
  return bucketIds.includes(bucketId);
}

function relationTypeValid(relationType: string) {
  return relationType == "onetoone" || relationType == "onetomany";
}

function isLocationTypeValid(locationType: string) {
  return locationTypes.includes(locationType);
}

export function getBucketName(id: string | ObjectId): string {
  return `Bucket_${id.toString()}`;
}

export function requestedFieldsFromInfo(info: GraphQLResolveInfo, rootKey?: string): string[][] {
  const [result] = info.fieldNodes.map(node =>
    extractFieldsFromNode(rootKey ? mergeNodes(node, rootKey) : node, [])
  );

  return result;
}

function extractFieldsFromNode(node: any, fields: string[]) {
  let result = [];
  node.selectionSet.selections.forEach(selection => {
    const currentPath = fields.concat([selection.name.value]);

    if (selection.selectionSet) {
      result = result.concat(extractFieldsFromNode(selection, currentPath));
    } else {
      result.push(currentPath);
    }
  });

  return result;
}

function mergeNodes(node: any, rootKey: string) {
  let mergedNode = {selectionSet: {selections: []}};
  if (
    node.selectionSet &&
    node.selectionSet.selections.some(selection => selection.name.value == rootKey)
  ) {
    mergedNode = node.selectionSet.selections
      .filter(selection => selection.name.value == rootKey)
      .reduce((acc, curr) => {
        acc.selectionSet.selections.push(...curr.selectionSet.selections);
        return acc;
      }, mergedNode);
  }
  return mergedNode;
}

export function extractAggregationFromQuery(bucket: any, query: object, buckets: Bucket[]): object {
  const bucketProperties = bucket.properties;
  if (ObjectId.isValid(bucket._id)) {
    bucketProperties._id = {
      type: "objectid"
    };
  }

  let finalExpression = {};
  for (const [key, value] of Object.entries(query)) {
    if (key == "OR" || key == "AND") {
      const conditions = [];
      const operator = `$${key.toLowerCase()}`;

      for (const condition of value) {
        const conditionExpression = extractAggregationFromQuery(bucket, condition, buckets);

        if (Object.keys(conditionExpression).length) {
          conditions.push(conditionExpression);
        }
      }

      if (conditions.length) {
        const expression = {
          [operator]: conditions
        };
        finalExpression = {...finalExpression, ...expression};
      }
    } else if (isParsableObject(value)) {
      if (bucket.properties[key].type == "relation") {
        const relatedBucketId = bucket.properties[key].bucketId;
        const relatedBucket = buckets.find(bucket => bucket._id == relatedBucketId);

        bucket.properties[key] = {
          _id: relatedBucketId,
          properties: relatedBucket.properties
        };
      }

      let expression = extractAggregationFromQuery(bucket.properties[key], value, buckets);
      expression = mergeNestedExpression({[key]: expression}, []);

      if (Object.keys(expression).length) {
        finalExpression = {...finalExpression, ...expression};
      }
    } else {
      const expression = createExpression(key, value, bucketProperties);

      if (expression) {
        //deep merge
        for (const [key, value] of Object.entries(expression)) {
          if (finalExpression[key] && isParsableObject(value)) {
            finalExpression[key] = {...finalExpression[key], ...value};
          } else {
            finalExpression[key] = value;
          }
        }
      }
    }
  }

  return finalExpression;
}

function createExpression(key: string, value: any, bucketProperties: any): object {
  const desiredProperty = Object.keys(bucketProperties).find(
    bucketProperty => bucketProperty == key
  );

  if (desiredProperty) {
    value = castToOriginalType(value, bucketProperties[desiredProperty]);
    return {
      [desiredProperty]: value
    };
  } else {
    const property = key.substring(0, key.lastIndexOf("_"));
    const operator = key.substring(key.lastIndexOf("_") + 1);
    const desiredProperty = Object.keys(bucketProperties).find(
      bucketProperty => bucketProperty == property
    );

    if (desiredProperty && operator) {
      value = castToOriginalType(value, bucketProperties[desiredProperty]);
      return {
        [desiredProperty]: {
          [`$${operator}`]: value
        }
      };
    }
  }
}

function castToOriginalType(value: any, property: any): unknown {
  switch (property.type) {
    case "date":
      return new Date(value);
    case "objectid":
      return new ObjectId(value);
    case "array":
      return value.map(val => castToOriginalType(val, property.items));
    default:
      return value;
  }
}

function mergeNestedExpression(expression: any, path: string[]) {
  let finalResult = {};
  if (isParsableObject(expression)) {
    for (const [key, value] of Object.entries(expression)) {
      if (key.startsWith("$")) {
        const expPath = path.join(".");
        const result = {[expPath]: expression};
        finalResult = {...finalResult, ...result};
        continue;
      }

      const result = mergeNestedExpression(value, path.concat([key]));
      if (isParsableObject(expression)) {
        finalResult = {...finalResult, ...result};
      }
    }
  } else {
    const expPath = path.join(".");
    const result = {[expPath]: expression};
    finalResult = {...finalResult, ...result};
  }
  return finalResult;
}

function isParsableObject(object: any): boolean {
  return (
    typeof object == "object" &&
    !Array.isArray(object) &&
    !ObjectId.isValid(object) &&
    !!Object.keys(object).length
  );
}

export function requestedFieldsFromExpression(expression: object, requestedFields: string[][]) {
  for (const [key, value] of Object.entries(expression)) {
    if (key == "$or" || key == "$and") {
      value.forEach(condition => requestedFieldsFromExpression(condition, requestedFields));
    } else {
      const field = key.split(".");
      requestedFields.push(field);
    }
  }
  return requestedFields;
}
