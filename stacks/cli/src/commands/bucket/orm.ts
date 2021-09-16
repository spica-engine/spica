import {ActionParameters, Command, CreateCommandParameters} from "@caporal/core";
import axios from "axios";
import * as fs from "fs";

async function orm({options}: ActionParameters) {
  const APIKEY = options.apikey as string;
  const APIURL = options.url as string;

  const buckets = await axios
    .get<any[]>(APIURL + "/bucket", {
      headers: {
        Authorization: `APIKEY ${APIKEY}`
      }
    })
    .then(r => r.data);



  let lines = [];

  lines.push("import * as Bucket from '@spica-devkit/bucket';");
  lines.push(`\nBucket.initialize({apikey:'${APIKEY}',publicUrl:'${APIURL}'});`);
  lines.push(
    "\n\ntype Rest<T extends any[]> = ((...p: T) => void) extends ((p1: infer P1, ...rest: infer R) => void) ? R : never;"
  );
  lines.push("\ntype getArgs = Rest<Parameters<typeof Bucket.data.get>>;");
  lines.push("\ntype getAllArgs = Rest<Parameters<typeof Bucket.data.getAll>>;");

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

function buildInterface(schema, lines) {
  const name = prepareInterfaceTitle(schema.title);
  lines.push(`\n\ninterface ${name}{`);
  lines.push(`\n  _id: string;`);
  buildProperties(schema.properties, schema.required || [], true, lines);
  lines.push("\n}");
}

function buildProperties(props, reqs, isRoot, lines) {
  if (!isRoot) {
    lines.push("\n{");
  }
  for (const [k, v] of Object.entries(props)) {
    const reqFlag = !reqs.includes(k) ? "?" : "";
    lines.push(`\n  ${k + reqFlag}: `);
    buildPropDef(v, lines);
    lines.push(";");
  }
  if (!isRoot) {
    lines.push("\n}");
  }
}

function buildArray(def, lines) {
  buildPropDef(def, lines);
  lines.push("[]");
}

// @TODO: Complete all types
function buildPropDef(prop, lines) {
  // @TODO: array enum does not fit here
  if (prop.enum) {
    lines.push("(");
    lines.push(prop.enum.map(v => (prop.type == "string" ? `'${v}'` : v)).join("|"));
    lines.push(")");

    if (prop.type == "array" || prop.type == "multiselect") {
      lines.push("[];");
    }

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
      buildProperties(prop.properties, prop.required || [], false, lines);
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

function prepareInterfaceTitle(str) {
  str = replaceNonWords(str);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function prepareNamespace(str) {
  str = replaceNonWords(str);
  str = str.toLowerCase();
  str = str.charAt(0).toLowerCase() + str.slice(1);
  if (str.match(/^[^a-zA-Z]/)) {
    str = "_" + str;
  }
  return str;
}

function replaceNonWords(str: string) {
  return str.replace(/[^a-zA-Z]/g, "_");
}

function buildMethod(schema, lines) {
  const namespace = prepareNamespace(schema.title);
  const interfaceName = prepareInterfaceTitle(schema.title);
  lines.push(`\nexport namespace ${namespace} {`);
  lines.push(`\n  const BUCKET_ID = '${schema._id}';`);

  // GET
  lines.push(`
  export const get = (...args: getArgs) => {
    return Bucket.data.get<${interfaceName}>(BUCKET_ID, args[0], args[1]);
  };`);

  // GETALL
  lines.push(`
  export const getAll = (...args: getAllArgs) => {
    //@ts-ignore
    return Bucket.data.getAll<${interfaceName}>(BUCKET_ID, args[0]) as Promise<${interfaceName}[]>;
  };`);

  // INSERT
  lines.push(`
  export const insert = (document: Omit<${interfaceName}, '_id'>) => {
    return Bucket.data.insert(BUCKET_ID, document) as Promise<${interfaceName}>;
  };`);

  // UPDATE
  lines.push(`
  export const update = (document: ${interfaceName}) => {
    return Bucket.data.update(
    BUCKET_ID,
    document._id,
    document
    ) as Promise<${interfaceName}>;
  };`);

  // PATCH
  lines.push(`  
  export const patch = (
    document: Omit<Partial<${interfaceName}>, '_id'> & { _id: string }
  ) => {
    return Bucket.data.patch(BUCKET_ID, document._id, document);
  };`);

  // DELETE
  lines.push(`  
  export const remove = (documentId: string) => {
    return Bucket.data.remove(BUCKET_ID, documentId);
  };`);

  lines.push("\n}");
}
