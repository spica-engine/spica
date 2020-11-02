import {Bucket, BucketDocument} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {diff, ChangeKind, ChangePaths} from "@spica-server/bucket/history/differ";
import {GraphQLResolveInfo} from "graphql";
import {Locale, buildI18nAggregation} from "../locale";
import {getRelationAggregation} from "../utility";
const JsonMergePatch = require("json-merge-patch");

enum Prefix {
  Type = "type",
  Input = "input"
}

enum Suffix {
  Type = "",
  Input = "Input"
}

enum UpdateType {
  Set,
  Unset
}

export function createSchema(bucket: Bucket, staticTypes: string) {
  let name = getBucketName(bucket._id);

  let schema = `
      ${staticTypes}
      
      type ${name}FindResponse{
        meta: Meta
        entries: [${name}]
      }

      type Query{
        Find${name}(limit: Int, skip: Int, sort: JSON ,language: String,schedule:Boolean ,query: JSON): ${name}FindResponse
        FindBy${name}Id(_id: ObjectID!, language: String):${name}
      }

      type Mutation{
        insert${name}(input: ${name}Input): ${name}
        replace${name}(_id: ObjectID!, input: ${name}Input): ${name}
        patch${name}(_id: ObjectID!, input: JSON): ${name}
        delete${name}(_id: ObjectID!): String
      }
    `;

  let types = createInterface(Prefix.Type, Suffix.Type, name, bucket, []);

  let inputs = createInterface(Prefix.Input, Suffix.Input, name, bucket, []);

  schema = schema + types + inputs;

  return schema;
}

function createInterface(
  prefix: string,
  suffix: string,
  name: string,
  schema: any,
  extras: string[]
) {
  let properties = [];

  if (schema._id && prefix == Prefix.Type) {
    properties.push("_id: ObjectID");
  }

  for (const [key, value] of Object.entries(schema.properties) as any) {
    let isRequired = schema.required && schema.required.includes(key);

    let property = createProperty(name, prefix, suffix, key, value, isRequired, extras);

    properties.push(property);
  }

  let result =
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
        ${values.join("\n")}
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
  extras: string[]
) {
  return `${key} : ${createPropertyValue(name, prefix, suffix, key, value, isRequired, extras)}`;
}

function createPropertyValue(
  name: string,
  prefix: string,
  suffix: string,
  key: string,
  value: any,
  isRequired: Boolean,
  extras: string[]
) {
  let result;

  if (value.enum) {
    if (prefix == Prefix.Type) {
      let extra = createEnum(`${name}_${key}`, value.enum);
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
        extras
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

    case "object":
      let extra = createInterface(prefix, suffix, `${name}_${key}`, value, []);
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
      break;

    case "relation":
      if (!value.bucketId) {
        throw Error(`Related bucket must be provided for ${key} field of ${name}.`);
      }

      let relatedBucketName = getBucketName(value.bucketId);
      result = prefix == Prefix.Type ? relatedBucketName : "String";
      result = value.relationType == "onetoone" ? result : `[${result}]`;
      break;

    default:
      throw Error(`Unknown type ${value.type} on ${key} field of ${name}.`);
  }

  if (isRequired && prefix == Prefix.Input) {
    result = result + "!";
  }

  return result;
}

export function getBucketName(uniqueField: string | ObjectId): string {
  return `Bucket_${uniqueField.toString()}`;
}

export async function aggregationsFromRequestedFields(
  bucket: Bucket,
  requestedFields: string[][],
  localeFactory: (language?: string) => Promise<Locale>,
  buckets: Bucket[],
  language?: string
) {
  let aggregations = [];

  let locale: Locale;
  if (requestedFields.length) {
    if (relationalFieldRequested(bucket.properties, requestedFields)) {
      locale = await localeFactory(language);
      let relationAggregation = getRelationAggregation(
        bucket.properties,
        JSON.parse(JSON.stringify(requestedFields)),
        locale,
        buckets
      );
      aggregations.push(...relationAggregation);
    }

    if (translatableFieldRequested(bucket.properties, requestedFields)) {
      locale = locale ? locale : await localeFactory(language);
      aggregations.push({
        $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
      });
    }
  }

  return aggregations;
}

export function requestedFieldsFromInfo(info: GraphQLResolveInfo, rootKey?: string): string[][] {
  let [result] = info.fieldNodes.map(node =>
    extractFieldsFromNode(rootKey ? mergeNodes(node, rootKey) : node, [])
  );

  return result;
}

function extractFieldsFromNode(node: any, fields: string[]) {
  let result = [];
  node.selectionSet.selections.forEach(selection => {
    let currentPath = fields.concat([selection.name.value]);

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

export function getProjectAggregation(requestedFields: string[][]) {
  let result = {};
  requestedFields.forEach(pattern => {
    let path = pattern.join(".");
    result[path] = 1;
  });
  return {$project: result};
}



export function extractAggregationFromQuery(bucket: any, query: object, buckets: Bucket[]): object {
  let bucketProperties = bucket.properties;
  if (ObjectId.isValid(bucket._id)) {
    bucketProperties._id = {
      type: "objectid"
    };
  }

  let finalExpression = {};
  for (const [key, value] of Object.entries(query)) {
    if (key == "OR" || key == "AND") {
      let conditions = [];
      let operator = `$${key.toLowerCase()}`;
      value.forEach(condition => {
        let conditionExpression = extractAggregationFromQuery(bucket, condition, buckets);

        if (Object.keys(conditionExpression).length) {
          conditions.push(conditionExpression);
        }
      });

      if (conditions.length) {
        let expression = {
          [operator]: conditions
        };
        finalExpression = {...finalExpression, ...expression};
      }
    } else if (isParsableObject(value)) {
      if (bucket.properties[key].type == "relation") {
        let relatedBucketId = bucket.properties[key].bucketId;
        let relatedBucket = buckets.find(bucket => bucket._id == relatedBucketId);

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
      let expression = createExpression(key, value, bucketProperties);

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
  let desiredProperty = Object.keys(bucketProperties).find(bucketProperty => bucketProperty == key);

  if (desiredProperty) {
    value = castToOriginalType(value, bucketProperties[desiredProperty]);
    return {
      [desiredProperty]: value
    };
  } else {
    let property = key.substring(0, key.lastIndexOf("_"));
    let operator = key.substring(key.lastIndexOf("_") + 1);
    let desiredProperty = Object.keys(bucketProperties).find(
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
      //@TODO: This line should be new ObjectId(value).
      //But there are too many methods that uses $toString operator to convert object id to string.
      //This issue will be handled on another task
      return value.toString();
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
        let expPath = path.join(".");
        let result = {[expPath]: expression};
        finalResult = {...finalResult, ...result};
        continue;
      }

      let result = mergeNestedExpression(value, path.concat([key]));
      if (isParsableObject(expression)) {
        finalResult = {...finalResult, ...result};
      }
    }
  } else {
    let expPath = path.join(".");
    let result = {[expPath]: expression};
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

export function getPatchedDocument(previousDocument: BucketDocument, patchQuery: any) {
  delete previousDocument._id;
  delete patchQuery._id;

  return JsonMergePatch.apply(JSON.parse(JSON.stringify(previousDocument)), patchQuery);
}

export function getUpdateQuery(previousDocument: BucketDocument, currentDocument: BucketDocument) {
  let updateQuery: any = {};

  let changes = diff(previousDocument, currentDocument);

  changes = changes.map(change => {
    let numIndex = change.path.findIndex(t => typeof t == "number");
    //item update is not possible with merge/patch,
    //we must put the given array directly
    if (numIndex > 0) {
      //if paths include array index, the last path before any number is the array path that will be put
      //we do not need to track rest of it
      change.path = change.path.slice(0, numIndex);
      //array updates will be handled with set operator.
      change.kind = ChangeKind.Edit;
    }
    return change;
  });

  const setTargets = changes
    .filter(change => change.kind != ChangeKind.Delete)
    .map(change => change.path);
  let setExpressions = createExpressionFromChange(currentDocument, setTargets, UpdateType.Set);
  if (Object.keys(setExpressions).length) {
    updateQuery.$set = setExpressions;
  }

  const unsetTargets = changes
    .filter(change => change.kind == ChangeKind.Delete)
    .map(change => change.path);
  let unsetExpressions = createExpressionFromChange(
    currentDocument,
    unsetTargets,
    UpdateType.Unset
  );
  if (Object.keys(unsetExpressions).length) {
    updateQuery.$unset = unsetExpressions;
  }

  return updateQuery;
}

function createExpressionFromChange(
  document: BucketDocument,
  targets: ChangePaths[],
  operation: UpdateType
) {
  let expressions = {};
  targets.forEach(target => {
    let key = target.join(".");
    let value = "";

    if (operation == UpdateType.Set) {
      value = findValueOfPath(target, document);
    }

    expressions[key] = value;
  });

  return expressions;
}

function findValueOfPath(path: (string | number)[], document: BucketDocument) {
  return path.reduce((document, name) => document[name], document);
}

function relationalFieldRequested(properties: object, requestedFields: string[][]): boolean {
  let relatedFields = [];
  Object.keys(properties).forEach(key => {
    if (properties[key].type == "relation") {
      relatedFields.push(key);
    }
  });

  return requestedFields.some(fields => relatedFields.includes(fields[0]));
}

function translatableFieldRequested(properties: object, requestedFields: string[][]): boolean {
  let translatableFields = [];
  for (const [key, value] of Object.entries(properties)) {
    if (value.options && value.options.translate) {
      translatableFields.push(key);
    }
  }

  return requestedFields.some(fields => translatableFields.includes(fields[0]));
}

export function requestedFieldsFromExpression(expression: object, requestedFields: string[][]) {
  for (const [key, value] of Object.entries(expression)) {
    if (key == "$or" || key == "$and") {
      value.forEach(condition => requestedFieldsFromExpression(condition, requestedFields));
    } else {
      let field = key.split(".");
      requestedFields.push(field);
    }
  }
  return requestedFields;
}

export function deepCopy(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
