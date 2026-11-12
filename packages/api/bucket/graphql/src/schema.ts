import {bucketIds} from "@spica-server/bucket-services";
import {ids, idOf} from "@spica-server/data";
import {conditionPaths, FilterCondition, FilterNode} from "@spica-server/interface-bucket-common";
import {Id} from "@spica-server/interface-data";
import {GraphQLResolveInfo} from "graphql";
import {Prefix, Suffix, SchemaWarning} from "@spica-server/interface-bucket-graphql";
import {Bucket} from "@spica-server/interface-bucket";

const locationTypes = ["Point"];

export function validateBuckets(buckets: Bucket[]) {
  const warnings: SchemaWarning[] = [];
  for (const bucket of buckets) {
    validateProperties(
      bucket,
      getBucketName(idOf(bucket)),
      buckets.map(bucket => idOf(bucket).toString()),
      warnings
    );
  }
  return {warnings, buckets};
}

function fixBucketProperties(bucket: Bucket, baseName: string, errors: SchemaWarning[]) {
  if (bucket.properties) return bucket;

  bucket.properties = {
    default: {
      type: "string",
      title: "default",
      description: "This field was created automatically because there was no other.",
      options: {}
    }
  };

  errors.push({
    target: baseName,
    reason: "Should have at least one property"
  });

  return bucket;
}

function validateProperties(
  bucket: Bucket,
  baseName: string,
  bucketIds: string[],
  errors: SchemaWarning[]
) {
  bucket = fixBucketProperties(bucket, baseName, errors);

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
  const name = getBucketName(idOf(bucket));
  let schema = `
      ${staticTypes}
      
      type ${name}FindResponse{
        meta: Meta
        data: [${name}]
      }

      type Query{
        Find${name}(limit: Int, skip: Int, sort: JSON, language: String, query: JSON): ${name}FindResponse
        FindBy${name}Id(_id: ObjectId!, language: String):${name}
      }

      type Mutation{
        insert${name}(input: ${name}Input): ${name}
        replace${name}(_id: ObjectId!, input: ${name}Input): ${name}
        patch${name}(_id: ObjectId!, input: JSON): ${name}
        delete${name}(_id: ObjectId!): String
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
    properties.push("_id: ObjectId");
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

export function getBucketName(id: string | Id): string {
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

type Properties = Record<string, any>;

function parseConditions(
  holder: {_id?: unknown; properties?: Properties},
  query: object,
  buckets: Bucket[],
  prefix: string[]
): FilterNode[] {
  const properties: Properties = {...holder.properties};
  if (bucketIds().isValid(holder._id)) {
    properties._id = {type: "objectid"};
  }

  const nodes: FilterNode[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (key == "OR" || key == "AND") {
      const children = (value as object[])
        .map(condition => group(parseConditions(holder, condition, buckets, prefix)))
        .filter(child => child);
      if (children.length) {
        nodes.push(key == "OR" ? {or: children} : {and: children});
      }
    } else if (isParsableObject(value)) {
      const property = properties[key];
      const nested =
        property?.type == "relation"
          ? buckets.find(bucket => idOf(bucket) == property.bucketId)
          : property;
      if (nested?.properties) {
        nodes.push(...parseConditions(nested, value, buckets, [...prefix, key]));
      }
    } else {
      const condition = createCondition(key, value, properties);
      if (condition) {
        nodes.push({...condition, path: [...prefix, ...condition.path]});
      }
    }
  }
  return nodes;
}

const group = (nodes: FilterNode[]): FilterNode | undefined =>
  nodes.length > 1 ? {and: nodes} : nodes[0];

export function parseQuery(
  bucket: Bucket,
  query: object,
  buckets: Bucket[]
): FilterNode | undefined {
  return group(parseConditions(bucket, query, buckets, []));
}

function createCondition(
  key: string,
  value: any,
  properties: Properties
): FilterCondition | undefined {
  const toCondition = (name: string, operator: string) => {
    const property = properties[name];
    return {
      path: [name],
      operator,
      value: castToOriginalType(value, property),
      ...(isIdProperty(property) && {id: true})
    };
  };

  if (key in properties) {
    return toCondition(key, "eq");
  }
  const property = key.substring(0, key.lastIndexOf("_"));
  const operator = key.substring(key.lastIndexOf("_") + 1);
  if (property in properties && operator) {
    return toCondition(property, operator);
  }
}

const isIdProperty = (property: any): boolean =>
  property?.type == "objectid" || (property?.type == "array" && isIdProperty(property.items));

function castToOriginalType(value: any, property: any): unknown {
  switch (property.type) {
    case "date":
      return new Date(value);
    case "array":
      return Array.isArray(value)
        ? value.map(val => castToOriginalType(val, property.items))
        : value;
    default:
      return value;
  }
}

function isParsableObject(object: any): boolean {
  return (
    typeof object == "object" &&
    object !== null &&
    !Array.isArray(object) &&
    !ids().unscoped().isValid(object) &&
    !!Object.keys(object).length
  );
}

export function requestedFieldsFromQuery(where: FilterNode | undefined): string[][] {
  return where ? conditionPaths(where) : [];
}
