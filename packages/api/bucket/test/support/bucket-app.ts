import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {
  CREATED_AT,
  DATE_TIME,
  OBJECT_ID,
  OBJECTID_STRING,
  SchemaModule,
  UPDATED_AT
} from "@spica-server/core-schema";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {ContractEngine} from "@spica-server/database-testing";
import {BUCKET_DATA_REPOSITORY, BucketOptions} from "@spica-server/interface-bucket";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";

type ModuleOptions = Partial<BucketOptions>;

export function withoutNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(withoutNulls) as T;
  }
  if (value && typeof value == "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, field]) => field !== null && field !== undefined)
        .map(([name, field]) => [name, withoutNulls(field)])
    ) as T;
  }
  return value;
}

export const keyFieldOf = (engine: ContractEngine): "_id" | "id" =>
  engine.name == "postgresql" ? "id" : "_id";

export function keyed(engine: ContractEngine, properties: Record<string, unknown>) {
  return engine.name == "postgresql"
    ? {primary: "id", properties: {id: {type: "uuid", options: {generated: true}}, ...properties}}
    : {properties};
}

const KEY_PROPERTY = {id: {type: "uuid", options: {generated: true}}};

function keyedDefinition(body: any) {
  if (!body || typeof body != "object" || !body.properties || body.properties.id) {
    return body;
  }
  return {...body, primary: "id", properties: {...KEY_PROPERTY, ...body.properties}};
}

const METHODS = ["get", "post", "put", "patch", "delete"];

function adaptingRequests(req: Request, omitNulls: boolean): Request {
  const adapt = (path: string, body: unknown) =>
    /^\/?bucket(\/[^/]+)?$/.test(path.split("?")[0]) ? keyedDefinition(body) : body;

  return new Proxy(req, {
    get(target, property) {
      const value = target[property];
      if (typeof value != "function") {
        return value;
      }
      if (!METHODS.includes(String(property))) {
        return value.bind(target);
      }
      return async (path: string, ...rest: unknown[]) => {
        const keyed = property == "post" || property == "put";
        const args = keyed ? [adapt(path, rest[0]), ...rest.slice(1)] : rest;
        const response = await value.call(target, path, ...args);
        return omitNulls ? {...response, body: withoutNulls(response.body)} : response;
      };
    }
  });
}

export function withoutBlanks<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(withoutBlanks) as T;
  }
  if (value && typeof value == "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, field]) => field !== null && field !== undefined)
        .filter(([, field]) => !Array.isArray(field) || field.length)
        .map(([name, field]) => [name, withoutBlanks(field)])
    ) as T;
  }
  return value;
}

export interface BucketApp {
  app: INestApplication;
  req: Request;
  module: TestingModule;
  keyField: "_id" | "id";
  invalidKeyMessage: string;
  definition(properties: Record<string, unknown>, extra?: object): any;
  createBucket(properties: Record<string, unknown>, extra?: object): Promise<any>;
  unknownKey(): string;
  stored(bucketId: string, documentId: string): Promise<any>;
  filter(mongodb: object, expression: string): string;
  close(): Promise<void>;
}

const DEFAULT_OPTIONS = {
  hooks: false,
  history: false,
  realtime: false,
  cache: false,
  graphql: false
} as BucketOptions;

export async function startBucketApp(
  engine: ContractEngine,
  options: ModuleOptions = {},
  extra: {
    passport?: Parameters<typeof PassportTestingModule.initialize>[0];
    imports?: any[];
    rejectOnError?: boolean;
    omitNulls?: boolean;
  } = {}
): Promise<BucketApp> {
  const postgres = engine.name == "postgresql";

  const module = await Test.createTestingModule({
    imports: [
      SchemaModule.forRoot({
        formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
        defaults: [CREATED_AT, UPDATED_AT]
      }),
      CoreTestingModule,
      PassportTestingModule.initialize(extra.passport),
      engine.module(),
      PreferenceTestingModule,
      BucketModule.forRoot({...DEFAULT_OPTIONS, ...options}),
      ...(extra.imports ?? [])
    ]
  }).compile();

  const app = module.createNestApplication();
  const request = module.get(Request);
  const req = postgres ? adaptingRequests(request, extra.omitNulls ?? false) : request;
  request.reject = extra.rejectOnError ?? true;
  app.use(Middlewares.MergePatchJsonParser(10));
  await app.listen(request.socket);

  const definition = (properties: Record<string, unknown>, extra: object = {}) => ({
    title: "New Bucket",
    description: "Describe your new bucket",
    icon: "view_stream",
    readOnly: false,
    ...extra,
    primary: postgres ? "id" : Object.keys(properties)[0],
    properties: postgres
      ? {id: {type: "uuid", options: {generated: true}}, ...properties}
      : properties
  });

  return {
    app,
    req,
    module,
    keyField: keyFieldOf(engine),
    invalidKeyMessage: postgres
      ? '.id should match format "uuid"'
      : '._id should match format "objectid"',
    definition,
    async createBucket(properties, extra) {
      const {body} = await req.post("/bucket", definition(properties, extra));
      return body;
    },
    async stored(bucketId, documentId) {
      const bucket = (await req.get(`/bucket/${bucketId}`)).body;
      const idType = await module.get<IdTypes>(ID_TYPES).forBucket(bucketId);
      return module
        .get(BUCKET_DATA_REPOSITORY, {strict: false})
        .findById(bucket, idType.parse(documentId));
    },
    filter: (mongodb, expression) => (postgres ? expression : JSON.stringify(mongodb)),
    unknownKey: () => String(module.get<IdTypes>(ID_TYPES).unscoped().generate()),
    close: () => app.close()
  };
}
