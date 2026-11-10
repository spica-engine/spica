import {ChunkKind, StreamChunk} from "@spica-server/interface-realtime";
import {levenshtein} from "@spica-server/realtime";
import {BatchQueries} from "./batch.js";

type Document = Record<string, unknown>;

export interface WindowSource {
  documents(): Promise<Document[]>;
  keys(batch?: BatchQueries): Promise<string[]>;
  matching(keys: string[], batch?: BatchQueries): Promise<Document[]>;
}

export interface KeyChange {
  key: string;
  operation: "insert" | "update" | "delete";
  fields?: string[];
  document?: Document;
}

export interface WindowShape {
  primary: string;
  sorted: boolean;
  ranged: boolean;
  relevant?: ReadonlySet<string>;
}

interface KeyHistory {
  last: KeyChange["operation"];
  inserted: boolean;
  unknown: boolean;
  fields: Set<string>;
  document?: Document;
}

function historyOf(changes: KeyChange[]) {
  const histories = new Map<string, KeyHistory>();
  for (const change of changes) {
    const history = histories.get(change.key) ?? {
      last: change.operation,
      inserted: false,
      unknown: false,
      fields: new Set<string>()
    };
    history.last = change.operation;
    if (change.operation == "insert") {
      history.inserted = true;
    } else if (change.operation == "update") {
      if (change.fields && change.document) {
        change.fields.forEach(field => history.fields.add(field));
        history.document = change.document;
      } else {
        history.unknown = true;
      }
    }
    histories.set(change.key, history);
  }
  return histories;
}

export class RealtimeWindow {
  private ids = new Set<string>();

  constructor(
    private readonly source: WindowSource,
    private readonly shape: WindowShape
  ) {}

  async initial(): Promise<StreamChunk<Document>[]> {
    const documents = await this.source.documents();
    this.ids = new Set(documents.map(document => this.keyOf(document)));
    return [
      ...documents.map(document => ({kind: ChunkKind.Initial, document})),
      {kind: ChunkKind.EndOfInitial}
    ];
  }

  async apply(changes: KeyChange[], batch?: BatchQueries): Promise<StreamChunk<Document>[]> {
    const {deleted, touched, unchanged} = this.classify(changes);
    const chunks = [...unchanged, ...this.forget(deleted)];
    if (!touched.length && !deleted.length) {
      return chunks;
    }

    const matching = await this.matchingBy(touched, batch);
    const window =
      this.shape.sorted || this.shape.ranged ? await this.source.keys(batch) : undefined;
    const inWindow = window && new Set(window);

    chunks.push(...this.reconcile(touched, matching, inWindow));
    if (window) {
      chunks.push(...(await this.settle(window, inWindow, batch)));
    }
    return chunks;
  }

  private classify(changes: KeyChange[]) {
    const deleted: string[] = [];
    const touched: string[] = [];
    const unchanged: StreamChunk<Document>[] = [];

    for (const [key, history] of historyOf(changes)) {
      if (history.last == "delete") {
        deleted.push(key);
      } else if (!this.cannotMatter(history)) {
        touched.push(key);
      } else if (this.ids.has(key)) {
        unchanged.push({kind: ChunkKind.Update, document: structuredClone(history.document)});
      }
    }
    return {deleted, touched, unchanged};
  }

  private forget(deleted: string[]) {
    return deleted
      .filter(key => this.ids.delete(key))
      .map(key => ({kind: ChunkKind.Delete, document: this.keyDocument(key)}));
  }

  private async matchingBy(touched: string[], batch?: BatchQueries) {
    const documents = touched.length ? await this.source.matching(touched, batch) : [];
    return new Map(documents.map(document => [this.keyOf(document), document]));
  }

  private reconcile(
    touched: string[],
    matching: Map<string, Document>,
    inWindow: Set<string> | undefined
  ) {
    const chunks: StreamChunk<Document>[] = [];
    for (const key of touched) {
      const document = matching.get(key);
      if (!document) {
        if (this.ids.delete(key)) {
          chunks.push({kind: ChunkKind.Expunge, document: this.keyDocument(key)});
        }
      } else if (!inWindow || inWindow.has(key)) {
        chunks.push({kind: this.ids.has(key) ? ChunkKind.Update : ChunkKind.Insert, document});
        this.ids.add(key);
      }
    }
    return chunks;
  }

  private cannotMatter(history: KeyHistory) {
    const {relevant} = this.shape;
    return (
      relevant !== undefined &&
      !history.inserted &&
      !history.unknown &&
      history.document !== undefined &&
      ![...history.fields].some(field => relevant.has(field))
    );
  }

  private async settle(window: string[], inWindow: Set<string>, batch?: BatchQueries) {
    const chunks: StreamChunk<Document>[] = [];
    const entering = window.filter(key => !this.ids.has(key));
    for (const document of entering.length ? await this.source.matching(entering, batch) : []) {
      chunks.push({kind: ChunkKind.Initial, document});
      this.ids.add(this.keyOf(document));
    }

    if (this.shape.sorted) {
      const order = levenshtein(this.ids, window);
      if (order.distance) {
        chunks.push({kind: ChunkKind.Order, sequence: order.sequence});
      }
    } else {
      for (const key of this.ids) {
        if (!inWindow.has(key)) {
          chunks.push({kind: ChunkKind.Expunge, document: this.keyDocument(key)});
        }
      }
    }

    this.ids = new Set(window);
    return chunks;
  }

  private keyOf(document: Document) {
    return String(document[this.shape.primary]);
  }

  private keyDocument(key: string): Document {
    return {[this.shape.primary]: key};
  }
}
