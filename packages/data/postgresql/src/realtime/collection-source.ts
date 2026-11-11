import {CollectionQueryFacade, ReadSpec} from "@spica-server/interface-data";
import {RealtimeOptions} from "@spica-server/interface-realtime";
import {BatchQueries} from "./batch.js";
import {compare, identityOf, sharedDocuments} from "./shared.js";
import {WindowSource} from "./window.js";

type Document = Record<string, unknown>;

export class CollectionSource implements WindowSource {
  private readonly identity: string;

  constructor(
    private readonly query: CollectionQueryFacade,
    private readonly collection: string,
    private readonly idProperty: string,
    private readonly options: RealtimeOptions
  ) {
    this.identity = identityOf({collection, ...options});
  }

  documents() {
    return this.read(this.range());
  }

  async keys(batch?: BatchQueries) {
    const documents = await this.shared(batch, "keys", () =>
      this.read({...this.range(), fields: {[this.idProperty]: 1}})
    );
    return documents.map(document => String(document[this.idProperty]));
  }

  matching(keys: string[], batch?: BatchQueries) {
    const sorted = [...keys].sort(compare);
    return this.shared(batch, `matching:${JSON.stringify(sorted)}`, () =>
      this.read({where: {...this.options.where, [this.idProperty]: {in: sorted}}})
    );
  }

  private shared(batch: BatchQueries | undefined, name: string, load: () => Promise<Document[]>) {
    return sharedDocuments(batch, this.identity, name, load);
  }

  private range(): ReadSpec {
    const {sort, skip, limit} = this.options;
    return {...(sort && {sort}), ...(skip && {skip}), ...(limit && {limit})};
  }

  private read(spec: ReadSpec): Promise<Document[]> {
    const {filter, resourceFilter, where, createdBetween} = this.options;
    return this.query.find<Document>(this.collection, {
      ...(filter && {filter}),
      ...(resourceFilter && {resourceFilter}),
      ...(where && {where}),
      ...(createdBetween && {createdBetween}),
      ...spec
    });
  }
}
