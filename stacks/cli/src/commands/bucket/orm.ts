import {ActionParameters, Command, CreateCommandParameters} from "@caporal/core";
import * as fs from "fs";
import * as path from "path";
import {config} from "../../config";
import {context} from "../../context";
import {spin} from "../../console";
import {httpService} from "../../http";

async function orm({options}: ActionParameters) {
  const PATH = (options.path as string) || "";
  const DESTINATION = path.join(PATH, "bucket.ts");

  const httpClient = await httpService.createFromCurrentCtx();

  const {url} = await context.getCurrent();

  await spin({
    text: "Fetching buckets..",
    op: async spinner => {
      const buckets = await httpClient.get<BucketSchema[]>("/bucket");

      spinner.text = "Building interface and method definitions..";

      const warnings: string[] = [];
      const content = Schema.createFileContent(buckets, url, warnings);

      spinner.text = "Writing to the destination..";
      fs.writeFileSync(DESTINATION, content);

      spinner.text = `Succesfully completed! File url is ${
        PATH ? DESTINATION : path.join(process.cwd(), "bucket.ts")
      }`;

      if (warnings.length) {
        spinner.warn(warnings.join());
      }
    }
  });
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Create object relational mapping applied version of @spica-devkit/bucket")
    .option(
      "--path <path>",
      "Full URL of the destination folder that the file will be created into. The current directory will be used as default"
    )
    .action(orm);
}

export namespace Schema {
  export function createFileContent(buckets: BucketSchema[], apiurl: string, warnings: string[]) {
    let lines: string[] = [];
    // DEVKIT INIT
    lines.push("import * as Bucket from '@spica-devkit/bucket';");
    lines.push(`
  /**
   * Call this method before interacting with buckets.
   * @param initOptions Initialize options to initialize the '@spica-devkit/bucket'.
   */
  export function initialize(
    ...initOptions: Parameters<typeof Bucket.initialize>
  ) {
    initOptions[0].publicUrl = '${apiurl}';
    Bucket.initialize(...initOptions);
  }`);

    // HELPER TYPE DEFINITIONS
    lines.push(
      "\n\ntype Rest<T extends any[]> = ((...p: T) => void) extends ((p1: infer P1, ...rest: infer R) => void) ? R : never;"
    );
    lines.push("\ntype getArgs = Rest<Parameters<typeof Bucket.data.get>>;");
    lines.push("\ntype getAllArgs = Rest<Parameters<typeof Bucket.data.getAll>>;");
    lines.push("\ntype realtimeGetArgs = Rest<Parameters<typeof Bucket.data.realtime.get>>;");
    lines.push("\ntype realtimeGetAllArgs = Rest<Parameters<typeof Bucket.data.realtime.getAll>>;");
    lines.push("\ntype id = { _id: string };");

    lines.push(`
type Find<Targets extends string[], Search extends string> = {
  [K in keyof Targets]: Targets[K] extends \`\${Search}.$\{infer Rest}\`
    ? Targets[K]
    : Targets[K] extends \`\${Search}\`
    ? Targets[K]
    : never;
}[number];

type FindRest<T extends string[], S extends string> = {
  [K in keyof T]: T[K] extends \`\${S}.$\{infer Rest}\`
    ? Rest
    : never
}[number]; 

type PickMethods<T, M extends keyof T> = {
  [K in M]: T[K] extends (...args: any[]) => any ? T[K] : never;
};

type ConvertArrayToTuple<T extends string[]> = T extends (infer U)[] ? [U, ...U[]] : never;

`);

    buckets = makeTitlesUnique(buckets, warnings);

    for (const bucket of buckets) {
      buildInterface(bucket, lines);
    }

    lines = replaceRelations(buckets, lines);

    lines = addCrud(lines, buckets);

    return lines.join("");
  }

  function addCrud(lines: string[], buckets: BucketSchema[]) {
    const crud = `
class CRUD<Scheme> {
  relation: string[] = [];

  constructor(
    protected bucketId: string,
    protected bdService: typeof Bucket.data,
    protected relationalFields: string[]
  ) {}

  private normalizeRelations(document: any) {
    this.relationalFields.forEach((field) => {
      if (typeof document[field] == 'object') {
        document[field] = Array.isArray(document[field])
          ? document[field].map((v: any) => v._id || v)
          : document[field]._id;
      }
    });
    return document;
  }

  private applyRelations(queryParams: any) {
    queryParams = queryParams || {};
    queryParams.relation = [...this.relation];
    this.relation = [];
  }

  get(...args: getArgs) {
    this.applyRelations(args[1]?.queryParams);
    return this.bdService.get<Scheme & id>(this.bucketId, ...args);
  }

  getAll(...args: getAllArgs) {
    this.applyRelations(args[0]?.queryParams);
    return this.bdService.getAll<Scheme & id>(this.bucketId, ...args);
  }

  insert(document: Omit<Scheme, '_id'>) {
    document = this.normalizeRelations(document);
    return this.bdService.insert(this.bucketId, document);
  }
  update(document: Scheme & id) {
    document = this.normalizeRelations(document);
    return this.bdService.update(this.bucketId, document._id, document);
  }
  patch(document: Partial<Scheme> & id) {
    document = this.normalizeRelations(document);
    return this.bdService.patch(this.bucketId, document._id, document);
  }

  remove(documentId: string) {
    return this.bdService.remove(this.bucketId, documentId);
  }

  realtime = {
    get: (...args: realtimeGetArgs) => {
      return this.bdService.realtime.get<Scheme & id>(
        this.bucketId,
        ...args
      );
    },
    getAll: (...args: realtimeGetAllArgs) => {
      return this.bdService.realtime.getAll<Scheme & id>(
        this.bucketId,
        ...args
      );
    },
  };
}`;

    lines.push("\n");
    lines.push(crud);

    for (let bucket of buckets) {
      const property = prepareNamespace(bucket.title);
      const interfaceName = prepareInterfaceTitle(bucket.title);

      const bucketId = bucket._id;
      const bdService = "Bucket.data";

      const relationalFields = getRelationFields(bucket.properties);
      const relationalFieldsDefinition = `[${relationalFields.map(i => `'${i}'`).join(",")}]`;

      const resolveRelationEnums = getResolveRelationEnums(bucket._id, buckets);
      const resolveRelationEnumsDefinition = resolveRelationEnums.length
        ? `(${resolveRelationEnums.map(i => `'${i}'`).join("|")})[]`
        : "[]";

      const crudDefinition = `
const ${interfaceName}RelationFields: string[] = ${relationalFieldsDefinition}
type ${interfaceName}RelationEnum = ${resolveRelationEnumsDefinition}
type ${interfaceName}RelationSelection = ConvertArrayToTuple<${interfaceName}RelationEnum>

export class ${interfaceName}CRUD extends CRUD<${interfaceName}<${interfaceName}RelationEnum>>{
  resolveRelations<R extends ${interfaceName}RelationSelection>(relations: R): PickMethods<CRUD<${interfaceName}<R>>,"get" | "getAll"> {
    const copy = new CRUD<${interfaceName}<R>>(this.bucketId,this.bdService,this.relationalFields)
    copy.relation.push(...relations);
    return copy;
  }
}
        `;
      lines.push(crudDefinition);

      const definition = `
export const ${property} = new ${interfaceName}CRUD('${bucketId}',${bdService},${interfaceName}RelationFields)
`;
      lines.push(definition);
    }

    return lines;
  }

  function buildInterface(schema: BucketSchema, lines: string[]) {
    const name = prepareInterfaceTitle(schema.title);
    lines.push(`\n\nexport interface ${name}<Relations extends string[] = []>{`);
    lines.push(`\n  _id?: string;`);
    buildProperties(schema.properties, schema.required || [], "bucket", lines);
    lines.push("\n}");
  }

  function prepareInterfaceTitle(str: string) {
    str = replaceNonWords(str);
    return str.charAt(0).toUpperCase() + str.slice(1);
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
    buildPropDef(key, value, lines);
    lines.push(";");
  }

  if (bucketOrObject == "object") {
    lines.push("}");
  }
}

function buildArray(key: string, def: Property, lines: string[]) {
  buildPropDef(key, def, lines);
  lines.push("[]");
}

function buildPropDef(key: string, prop: Property, lines: string[]) {
  if (prop.enum) {
    lines.push("(");
    lines.push(
      // escape the quote character otherwise it breaks the definition
      prop.enum.map(v => (prop.type == "string" ? `'${v.replace(/'/g, "\\'")}'` : v)).join("|")
    );
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
      buildArray(key, prop.items, lines);
      break;

    case "relation":
      const suffix = prop.relationType == "onetomany" ? "[]" : "";
      const definition = `Find<Relations,"${key}">[] extends never[] ? string${suffix} : (<${prop.bucketId}><FindRest<Relations,"${key}">[]>&id)${suffix}`;
      lines.push(definition);
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
function getRelationFields(properties: Properties) {
  const fields: string[] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (value.type == "relation") {
      fields.push(key);
    }
  }
  return fields;
}

function makeTitlesUnique(buckets: BucketSchema[], warnings: string[]): BucketSchema[] {
  const titles = [];
  for (const bucket of buckets) {
    const title = bucket.title;

    const count = titles.filter(t => t == title).length;
    if (count >= 1) {
      warnings.push(`It seems there is more than one bucket that has the title '${bucket.title}'. 
Number suffix will be added but should use unique titles for the best practice.`);
      bucket.title += count + 1;
    }

    titles.push(title);
  }
  return buckets;
}

function getResolveRelationEnums(id: string, buckets: BucketSchema[]): string[] {
  const enums: string[] = [];
  const maxDepth = 5;

  const _getResolveRelationEnums = (_bucket: BucketSchema, prefix?) => {
    const hasRelation = Object.values(_bucket.properties).some(v => v.type == "relation");
    if (!hasRelation) {
      if (prefix && !enums.includes(prefix)) {
        enums.push(prefix);
      }
      return;
    }

    Object.entries(_bucket.properties).forEach(([key, value]) => {
      if (value.type == "relation") {
        const paths = prefix ? `${prefix}.${key}` : key;

        const isMaxLengthExceeded = paths.split(".").length > maxDepth;
        if (isMaxLengthExceeded) {
          return;
        }

        if (!enums.includes(paths)) {
          enums.push(paths);
        }

        const relatedBuckets = buckets.filter(b => b._id == value.bucketId);
        relatedBuckets.forEach(b => _getResolveRelationEnums(b, paths));
      }
    });
  };

  const targetBucket = buckets.find(b => b._id == id);
  _getResolveRelationEnums(targetBucket);

  return enums;
}

// INTERFACE
export interface BucketSchema {
  _id: string;
  title: string;
  properties: Properties;
  required?: string[];
  [key: string]: any;
}

export type Properties = {[key: string]: Property};

export type Property =
  | BasicProperty
  | ArrayProperty
  | ObjectProperty
  | RelationProperty
  | LocationProperty;

interface IProperty {
  type: string;
  enum?: any[];
  [key: string]: any;
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
  required?: string[];
}

interface RelationProperty extends IProperty {
  type: "relation";
  bucketId: string;
  relationType: "onetoone" | "onetomany";
}

interface LocationProperty extends IProperty {
  type: "location";
}

// type Includes<Arr extends string[], Str extends string> = Extract<Arr[number], Str> extends never ? false : true;

// type Find<Targets extends string[], Search extends string> = {
//   [K in keyof Targets]: Targets[K] extends Search ? Targets[K] : never;
// }[number];

// type FindRest<T extends string[], S extends string> = {
//   [K in keyof T]: T[K] extends `${S}.${infer Rest}`
//     ? Rest
//     : never
// }[number]

// type DeliveryRelationEnum = 'user' | 'user.address' | 'user.address.loc' | 'order'

// interface Delivery<Relations extends DeliveryRelationEnum[] = []> {
//   title: string;
//   user: Find<Relations, "user"> extends never ? string : User;
//   order: Find<Relations, "order"> extends never ? string : Order;
// }

// interface User<Relations extends string[] = []> {
//   name: string;
//   surname: string;
//   address: Find<Relations,"address">[] extends never[] ? string : Address<FindRest<Relations,"address">[]>
// }

// interface Address<Relations extends string[] = []> {
//   street: string;
//   city: string;
//   location: Find<Relations,"loc">[] extends never[] ? string : Loc<FindRest<Relations,"loc">[]>
// }

// interface Loc<Relations extends string[] = []>{
//   lat:number,
//   lng:number
// }

// interface Order<Relations extends string[] = []> {
//   type: string;
// }

// type UnionToTuple<T extends string[]> = (
//   T extends any ? (arg: T) => void : never
// ) extends (arg: infer U) => void ? U : never;

// type ConvertArrayToTuple<T extends string[]> = T extends (infer U)[] ? [U, ...U[]] : never;

// function resolve<T extends ConvertArrayToTuple<DeliveryRelationEnum[]>>(relations: T): Delivery<T> {
//   return null as any; // Placeholder implementation
// }

// resolve(["order","user"])

// class MyClass {
//   method1() {
//     console.log("Method 1");
//   }

//   method2() {
//     console.log("Method 2");
//   }

//   method3() {
//     console.log("Method 3");
//   }
// }

// type RemoveMethods<T, M extends keyof T> = {
//   [K in keyof T as K extends M ? never : K]: T[K];
// };

// type MyPickedMethods = PickMethods<MyClass, "method1" | "method3">;

// const obj: MyPickedMethods = new MyClass();
// obj.method1(); // Output: Method 1
// obj.method2(); // Output: Method 1
// obj.method3(); // Output: Method 3

// type PickMethods<T, M extends keyof T> = {
//   [K in M]: T[K] extends (...args: any[]) => any ? T[K] : never;
// };
