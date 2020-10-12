import {Bucket} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";

export function createSchema(bucket: Bucket) {
  let name = getBucketName(bucket._id);

  let schema = `
      type ${name}FindResponse{
        meta: Meta
        entries: [${name}]
      }

      type Query{
        Find${name}(limit: Int, skip: Int, sort: JSON ,language: String, query: JSON): ${name}FindResponse
        FindBy${name}Id(_id: ObjectID!, language: String):${name}
      }

      type Mutation{
        insert${name}(input: ${name}Input): ${name}
        replace${name}(_id: ObjectID!, input: ${name}Input): ${name}
        patch${name}(_id: ObjectID!, input: JSON): ${name}
        delete${name}(_id: ObjectID!): Boolean
      }
    `;

  let types = createInterface("type", "", getBucketName(bucket._id), bucket, []);

  let inputs = createInterface("input", "Input", getBucketName(bucket._id), bucket, []);

  schema = schema + types + inputs;

  //console.log(schema);

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

  if (schema._id && prefix == "type") {
    properties.push("_id: ObjectID");
  }

  for (const [key, value] of Object.entries(schema.properties) as any) {
    let isRequired = false;
    let isEnum = !!value.enum;

    if (schema.required && schema.required.includes(key)) {
      isRequired = true;
    }

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
        ${values.join(",")}
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
    let extra = createEnum(`${name}_${key}`, value.enum);
    extras.push(extra);
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
      result = prefix == "type" ? "Location" : "LocationInput";
      break;
    case "relation":
      let relatedBucketName = getBucketName(value.bucketId);
      result = prefix == "type" ? relatedBucketName : "String";
      result = value.relationType == "onetoone" ? result : `[${result}]`;
      break;
    //find related bucket and resolve relation for types, unresolve for inputs
    default:
      //for development
      result = "String";
      break;
  }

  if (isRequired) {
    result = result + "!";
  }

  return result;
}

export function getBucketName(uniqueField: string | ObjectId): string {
  return `Bucket_${uniqueField.toString()}`;
}
