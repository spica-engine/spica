import {Bucket} from "@spica-server/interface-bucket";
import {
  BucketQueryFacade,
  BucketReadContext,
  BucketReadSpec
} from "@spica-server/interface-bucket-common";
import {RealtimeOptions} from "@spica-server/interface-realtime";
import {WindowSource} from "./window.js";

type Document = Record<string, unknown>;

export class BucketSource implements WindowSource {
  constructor(
    private readonly query: BucketQueryFacade,
    private readonly bucket: Bucket,
    private readonly context: BucketReadContext,
    private readonly options: RealtimeOptions
  ) {}

  documents() {
    return this.read({...this.range()});
  }

  async keys() {
    const primary = this.bucket.primary;
    const documents = await this.read({...this.range(), projectMap: [[primary]]});
    return documents.map(document => String(document[primary]));
  }

  matching(keys: string[]) {
    return this.read({resourceFilter: {include: keys, exclude: []}});
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
