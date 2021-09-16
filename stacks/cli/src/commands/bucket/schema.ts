import {BucketSchema, Properties, Property} from "./interface";

export function createFileContent(buckets: BucketSchema[], apikey: string, apiurl: string) {
  let lines: string[] = [];
  // DEVKIT INIT
  lines.push("import * as Bucket from '@spica-devkit/bucket';");
  lines.push(`\nBucket.initialize({apikey:'${apikey}',publicUrl:'${apiurl}'});`);

  // HELPER TYPE DEFINITIONS
  lines.push(
    "\n\ntype Rest<T extends any[]> = ((...p: T) => void) extends ((p1: infer P1, ...rest: infer R) => void) ? R : never;"
  );
  lines.push("\ntype getArgs = Rest<Parameters<typeof Bucket.data.get>>;");
  lines.push("\ntype getAllArgs = Rest<Parameters<typeof Bucket.data.getAll>>;");
  lines.push("\ntype realtimeGetArgs = Rest<Parameters<typeof Bucket.data.realtime.get>>;");
  lines.push("\ntype realtimeGetAllArgs = Rest<Parameters<typeof Bucket.data.realtime.getAll>>;");

  for (const bucket of buckets) {
    buildInterface(bucket, lines);
    buildMethod(bucket, lines);
  }

  lines = replaceRelations(buckets, lines);

  return lines.join("");
}

function buildInterface(schema: BucketSchema, lines: string[]) {
  const name = prepareInterfaceTitle(schema.title);
  lines.push(`\n\ninterface ${name}{`);
  lines.push(`\n  _id: string;`);
  buildProperties(schema.properties, schema.required || [], "bucket", lines);
  lines.push("\n}");
}

function prepareInterfaceTitle(str: string) {
  str = replaceNonWords(str);
  return str.charAt(0).toUpperCase() + str.slice(1);
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

function replaceRelations(buckets: BucketSchema[], lines: string[]) {
  for (const bucket of buckets) {
    const target = `<${bucket._id}>`;
    lines = lines.map(line => {
      if (line.includes(target)) {
        return line.replace(target, prepareInterfaceTitle(bucket.title));
      }
      return line;
    });
  }
  return lines;
}

// HELPERS
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
