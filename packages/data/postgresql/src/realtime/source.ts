import {Bucket} from "@spica-server/interface-bucket";
import {
  BucketQueryFacade,
  BucketReadContext,
  BucketReadSpec
} from "@spica-server/interface-bucket-common";
import {RealtimeOptions} from "@spica-server/interface-realtime";
import {BatchQueries} from "./batch.js";
import {compare, identityOf, sharedDocuments} from "./shared.js";
import {WindowSource} from "./window.js";
import {idOf} from "@spica-server/data";

type Document = Record<string, unknown>;

export class BucketSource implements WindowSource {
  private readonly identity: string;

  constructor(
    private readonly query: BucketQueryFacade,
    private readonly bucket: Bucket,
    private readonly context: BucketReadContext,
    private readonly options: RealtimeOptions
  ) {
    this.identity = identityOf({bucket: String(idOf(bucket)), ...options});
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

  private shared(batch: BatchQueries | undefined, name: string, load: () => Promise<Document[]>) {
    return sharedDocuments(batch, this.identity, name, load);
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
