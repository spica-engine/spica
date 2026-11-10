import {createHash} from "node:crypto";
import {Bucket} from "@spica-server/interface-bucket";
import {
  BucketQueryFacade,
  BucketReadContext,
  BucketReadSpec
} from "@spica-server/interface-bucket-common";
import {RealtimeOptions} from "@spica-server/interface-realtime";
import {BatchQueries} from "./batch.js";
import {WindowSource} from "./window.js";

type Document = Record<string, unknown>;

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof (value as {toJSON?: unknown}).toJSON == "function") {
    return canonical((value as {toJSON(): unknown}).toJSON());
  }
  if (value && typeof value == "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => compare(a, b))
        .map(([key, item]) => [key, canonical(item)])
    );
  }
  return value;
}

export class BucketSource implements WindowSource {
  private readonly identity: string;

  constructor(
    private readonly query: BucketQueryFacade,
    private readonly bucket: Bucket,
    private readonly context: BucketReadContext,
    private readonly options: RealtimeOptions
  ) {
    this.identity = createHash("sha256")
      .update(JSON.stringify(canonical({bucket: String(bucket._id), ...options})))
      .digest("hex");
  }

  documents() {
    return this.read({...this.range()});
  }

  async keys(batch?: BatchQueries) {
    const primary = this.bucket.primary;
    const documents = await this.shared(batch, "keys", () =>
      this.read({...this.range(), projectMap: [[primary]]})
    );
    return documents.map(document => String(document[primary]));
  }

  matching(keys: string[], batch?: BatchQueries) {
    const sorted = [...keys].sort(compare);
    return this.shared(batch, `matching:${JSON.stringify(sorted)}`, () =>
      this.read({resourceFilter: {include: sorted, exclude: []}})
    );
  }

  private async shared(
    batch: BatchQueries | undefined,
    name: string,
    load: () => Promise<Document[]>
  ) {
    const documents = batch ? await batch.once(`${this.identity}:${name}`, load) : await load();
    return structuredClone(documents);
  }

  private range(): BucketReadSpec {
    const {sort, skip, limit} = this.options;
    return {...(sort && {sort}), ...(skip && {skip}), ...(limit && {limit})};
  }

  private async read(spec: BucketReadSpec): Promise<Document[]> {
    const {filter, applyAcl, user} = this.options;
    const {result} = await this.query.find<Document>(
      this.bucket,
      {...(filter && {filter}), ...(applyAcl && {applyAcl, user}), ...spec},
      this.context
    );
    return result;
  }
}
