import {ActionParameters, Command, CreateCommandParameters} from "@caporal/core";
import axios from "axios";
import * as fs from "fs";

async function orm({options}: ActionParameters) {
  const APIKEY = options.apikey as string;
  const APIURL = options.url as string;

  const buckets = await axios
    .get<BucketSchema[]>(APIURL + "/bucket", {
      headers: {
        Authorization: `APIKEY ${APIKEY}`
      }
    })
    .then(r => r.data);

  let lines: string[] = [];

  // DEVKIT INIT
  lines.push("import * as Bucket from '@spica-devkit/bucket';");
  lines.push(`\nBucket.initialize({apikey:'${APIKEY}',publicUrl:'${APIURL}'});`);

  // HELPER TYPE DEFINITIONS
  lines.push(
    "\n\ntype Rest<T extends any[]> = ((...p: T) => void) extends ((p1: infer P1, ...rest: infer R) => void) ? R : never;"
  );
  lines.push("\ntype getArgs = Rest<Parameters<typeof Bucket.data.get>>;");
  lines.push("\ntype getAllArgs = Rest<Parameters<typeof Bucket.data.getAll>>;");
  lines.push("\ntype realtimeGetArgs = Rest<Parameters<typeof Bucket.data.realtime.get>>;");
  lines.push("\ntype realtimeGetAllArgs = Rest<Parameters<typeof Bucket.data.realtime.getAll>>;");

  // interface and methods definitions
  for (const bucket of buckets) {
    buildInterface(bucket, lines);
    buildMethod(bucket, lines);
  }

  // relation replacement
  buckets.forEach(bucket => {
    const target = `<${bucket._id}>`;
    lines = lines.map(line => {
      if (line.includes(target)) {
        return line.replace(target, prepareInterfaceTitle(bucket.title));
      }
      return line;
    });
  });

  fs.writeFileSync("bucket.ts", lines.join(""));
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Extract applied object relational mapping version of @spica-devkit/bucket")
    .option("--url <url>", "Url of the API.", {required: true})
    .option("-a <apikey>, --apikey <apikey>", "Authorize via an API Key.", {required: true})
    .action(orm);
}

function buildInterface(schema: BucketSchema, lines: string[]) {
  const name = prepareInterfaceTitle(schema.title);
  lines.push(`\n\ninterface ${name}{`);
  lines.push(`\n  _id: string;`);
  buildProperties(schema.properties, schema.required || [], "bucket", lines);
  lines.push("\n}");
}

function buildProperties(
  props: Properties,
  reqs: string[],
  bucketOrObject: "bucket" | "object",
  lines: string[]
) {
  if (bucketOrObject == "object") {
    lines.push("{");
  }

  for (const [key, value] of Object.entries(props)) {
    const reqFlag = !reqs.includes(key) ? "?" : "";
    lines.push(`\n  ${key + reqFlag}: `);
    buildPropDef(value, lines);
    lines.push(";");
  }

  if (bucketOrObject == "object") {
    lines.push("}");
  }
}

function buildArray(def: Property, lines: string[]) {
  buildPropDef(def, lines);
  lines.push("[]");
}

function buildPropDef(prop: Property, lines: string[]) {
  if (prop.enum) {
    lines.push("(");
    lines.push(prop.enum.map(v => (prop.type == "string" ? `'${v}'` : v)).join("|"));
    lines.push(")");
    return;
  }

  switch (prop.type) {
    case "string":
    case "textarea":
    case "color":
    case "richtext":
    case "storage":
      lines.push("string");
      break;

    case "number":
      lines.push("number");
      break;

    case "date":
      lines.push("Date | string");
      break;

    case "boolean":
      lines.push("boolean");
      break;

    case "object":
      buildProperties(prop.properties, prop.required || [], "object", lines);
      break;

    case "array":
    case "multiselect":
      buildArray(prop.items, lines);
      break;

    case "relation":
      lines.push(`(<${prop.bucketId}> | string)${prop.relationType == "onetomany" ? "[]" : ""}`);
      break;

    case "location":
      lines.push(`{ type: "Point", coordinates: [number,number]}`);
      break;

    default:
      lines.push("any");
      break;
  }
}

function prepareInterfaceTitle(str: string) {
  str = replaceNonWords(str);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function prepareNamespace(str: string) {
  str = replaceNonWords(str);
  str = str.toLowerCase();
  if (str.match(/^[0-9]/)) {
    str = "_" + str;
  }
  return str;
}

function replaceNonWords(str: string) {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}

function buildMethod(schema: BucketSchema, lines: string[]) {
  const namespace = prepareNamespace(schema.title);
  const interfaceName = prepareInterfaceTitle(schema.title);

  lines.push(`\nexport namespace ${namespace} {`);
  lines.push(`\n  const BUCKET_ID = '${schema._id}';`);

  // GET
  lines.push(`
  export function get (...args: getArgs) {
    return Bucket.data.get<${interfaceName}>(BUCKET_ID, ...args);
  };`);

  // GETALL
  lines.push(`
  export function getAll (...args: getAllArgs) {
    return Bucket.data.getAll<${interfaceName}>(BUCKET_ID, ...args);
  };`);

  // INSERT
  lines.push(`
  export function insert (document: Omit<${interfaceName}, '_id'>) {
    return Bucket.data.insert(BUCKET_ID, document);
  };`);

  // UPDATE
  lines.push(`
  export function update (document: ${interfaceName}) {
    return Bucket.data.update(
      BUCKET_ID,
      document._id,
      document
    );
  };`);

  // PATCH
  lines.push(`  
  export function patch (
    document: Omit<Partial<${interfaceName}>, '_id'> & { _id: string }
  ) {
    return Bucket.data.patch(BUCKET_ID, document._id, document);
  };`);

  // DELETE
  lines.push(`  
  export function remove (documentId: string) {
    return Bucket.data.remove(BUCKET_ID, documentId);
  };`);

  // REALTIME
  lines.push("\n  export namespace realtime {");

  // GET
  lines.push(`
    export function get (...args: realtimeGetArgs) {
      return Bucket.data.realtime.get<New_Bucket>(BUCKET_ID, ...args);
    };`);

  // GETALL
  lines.push(`
    export function getAll (...args: realtimeGetAllArgs) {
      return Bucket.data.realtime.getAll<New_Bucket>(BUCKET_ID, ...args);
    };`);
  lines.push("\n  }");

  lines.push("\n}");
}

interface BucketSchema {
  _id: string;
  title: string;
  properties: Properties;
  required: string[];
}

type Properties = {[key: string]: Property};

type Property =
  | BasicProperty
  | ArrayProperty
  | ObjectProperty
  | RelationProperty
  | LocationProperty;

interface IProperty {
  type: string;
  enum?: any[];
}

interface BasicProperty extends IProperty {
  type: "string" | "textarea" | "color" | "richtext" | "storage" | "number" | "date" | "boolean";
}

interface ArrayProperty extends IProperty {
  type: "array" | "multiselect";
  items: Property;
}

interface ObjectProperty extends IProperty {
  type: "object";
  properties: Properties;
  required: string[];
}

interface RelationProperty extends IProperty {
  type: "relation";
  bucketId: string;
  relationType: "onetoone" | "onetomany";
}

interface LocationProperty extends IProperty {
  type: "location";
}
