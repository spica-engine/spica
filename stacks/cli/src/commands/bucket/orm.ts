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
      const languages = await httpClient
        .get<{language: {available: {[lang: string]: string}}}>("/preference/bucket")
        .then(r => Object.keys(r.language.available));

      spinner.text = "Building interface and method definitions..";

      const warnings: string[] = [];
      const content = Schema.createFileContent(buckets, languages, url, warnings);

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
  export function createFileContent(
    buckets: BucketSchema[],
    languages: string[],
    apiurl: string,
    warnings: string[]
  ) {
    const languagesDefinition = `${languages.map(i => `'${i}'`).join("|")}`;

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

type ConvertEnumToSelection<T extends string[]> = T extends []
  ? []
  : T extends (infer U)[]
  ? [U, ...U[]]
  : [];

type Props<T> = {
  [K in keyof T]: K;
}[keyof T];

type RemoveProps<TClass, TProps extends keyof TClass> = {
  [K in keyof TClass as K extends TProps ? never : K]: TClass[K];
};

type AvailableLanguages = ${languagesDefinition}

`);

    buckets = makeTitlesUnique(buckets, warnings);

    for (const bucket of buckets) {
      buildInterface(bucket, languages, lines);
    }

    lines = replaceRelations(buckets, lines);

    lines = addCrud(lines, buckets, languages);

    return lines.join("");
  }

  function addCrud(lines: string[], buckets: BucketSchema[], languages: string[]) {
    const crud = `
class CRUD<Scheme,Paginate extends boolean = false> {
  protected options: {
    headers: {
      'accept-language'?: string;
    };
    queryParams: {
      limit?: number;
      skip?: number;
      sort?: {
        [T in keyof Scheme]: -1 | 1;
      };
      paginate?: boolean;

      relation?: string[];
      localize?: boolean;
      filter?: any;
    };
  } = {
    headers: {},
    queryParams: {},
  };

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

  private buildOptions(options: any) {
    options = options ? options : this.options;
    this.options = {
      headers: {},
      queryParams: {},
    };
    return options;
  }

  get(...args: getArgs) {
    args[1] = this.buildOptions(args[1]);
    return this.bdService.get<Scheme & id>(this.bucketId, ...args);
  }

  getAll(
    ...args: getAllArgs
  ): Paginate extends true
    ? Promise<Bucket.IndexResult<Scheme>>
    : Promise<Scheme[]> {
    args[0] = this.buildOptions(args[0]);
    return this.bdService.getAll<Scheme & id>(
      this.bucketId,
      ...args
    ) as Paginate extends true
      ? Promise<Bucket.IndexResult<Scheme>>
      : Promise<Scheme[]>;
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
}

class QueryBuilderCRUD<Scheme,Paginate extends boolean = false> extends CRUD<Scheme,Paginate>{
  limit(limit: number): any {
    this.options.queryParams.limit = limit;
    return this;
  }

  skip(skip: number): any {
    this.options.queryParams.skip = skip;
    return this;
  }

  sort(sort: { [T in keyof Scheme]: -1 | 1 }): any {
    this.options.queryParams.sort = sort;
    return this;
  }

  filter(filter: any): any {
    this.options.queryParams.filter = filter;
    return this;
  }

  translate(language: AvailableLanguages): any {
    this.options.headers['accept-language'] = language;
    return this;
  }

  paginate(): any {
    this.options.queryParams.paginate = true;
    return this;
  }

  nonLocalize(): any {
    this.options.queryParams.localize = false;
    return this;
  }  

  resolveRelations(relation:any): any {
    this.options.queryParams.relation = relation;
    return this;
  }
}
`;

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
type ${interfaceName}RelationSelection = ConvertEnumToSelection<${interfaceName}RelationEnum>
type ${interfaceName}QueryableMethods<
  R extends string[] = [],
  P extends boolean = false,
  L extends boolean = true
> = RemoveProps<
  ${interfaceName}CRUD<R, P, L>,
  Exclude<Props<CRUD<${interfaceName}<R, L>, P>>, 'get' | 'getAll'>
>;

class ${interfaceName}CRUD<R extends string[] = [], P extends boolean = false, L extends boolean = true> extends QueryBuilderCRUD<${interfaceName}<R,L>,P>{
  
 
  override resolveRelations<Selecteds extends ${interfaceName}RelationSelection>(
    relations: Selecteds
  ): ${interfaceName}QueryableMethods<Selecteds, P, L> {
    super.resolveRelations(relations);
    //@ts-ignore
    return this as ${interfaceName}QueryableMethods<Selecteds, P, L>
  }

  override nonLocalize(): ${interfaceName}QueryableMethods<R, P, false> {
    super.nonLocalize();
    return this as ${interfaceName}QueryableMethods<R, P, false>;
  }

  override limit(limit: number): ${interfaceName}QueryableMethods<R, P, L> {
    super.limit(limit);
    return this;
  }

  override skip(skip: number): ${interfaceName}QueryableMethods<R, P, L> {
    super.skip(skip);
    return this;
  }

  override sort(sort: {
    [T in keyof ${interfaceName}]: -1 | 1;
  }): ${interfaceName}QueryableMethods<R, P, L> {
    super.sort(sort);
    return this;
  }

  override filter(filter: any): ${interfaceName}QueryableMethods<R, P, L> {
    super.filter(filter);
    return this;
  }

  override translate(
    language: AvailableLanguages
  ): ${interfaceName}QueryableMethods<R, P, L> {
    super.translate(language);
    return this;
  }

  override paginate(): ${interfaceName}QueryableMethods<R, true, L> {
    super.paginate();
    return this as ${interfaceName}QueryableMethods<R, true, L>;
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

  function buildInterface(schema: BucketSchema, languages: string[], lines: string[]) {
    const name = prepareInterfaceTitle(schema.title);
    lines.push(
      `\n\nexport interface ${name}<Relations extends string[] = [], Localize extends boolean = true>{`
    );
    lines.push(`\n  _id?: string;`);
    buildProperties(schema.properties, languages, schema.required || [], "bucket", lines);
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
  languages: string[],
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
    buildPropDef(key, value, languages, lines);
    lines.push(";");
  }

  if (bucketOrObject == "object") {
    lines.push("}");
  }
}

function buildArray(key: string, def: Property, languages: string[], lines: string[]) {
  buildPropDef(key, def, languages, lines);
  lines.push("[]");
}

function buildPropDef(key: string, prop: Property, languages: string[], lines: string[]) {
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
      let def = "string";

      if (prop.options && prop.options.translate) {
        let nonLocalizedType = {};
        languages.forEach(l => (nonLocalizedType[l] = "string"));
        nonLocalizedType = JSON.stringify(nonLocalizedType);
        def = `Localize extends true ? string : ${nonLocalizedType}`;
      }

      lines.push(def);
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
      buildProperties(prop.properties, prop.required || [], languages, "object", lines);
      break;

    case "array":
    case "multiselect":
      buildArray(key, prop.items, languages, lines);
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
  options: {
    translate: boolean;
  };
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
