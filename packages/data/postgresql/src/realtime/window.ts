import {ChunkKind, StreamChunk} from "@spica-server/interface-realtime";
import {levenshtein} from "@spica-server/realtime";

type Document = Record<string, unknown>;

export interface WindowSource {
  documents(): Promise<Document[]>;
  keys(): Promise<string[]>;
  matching(keys: string[]): Promise<Document[]>;
}

export interface KeyChange {
  key: string;
  operation: "insert" | "update" | "delete";
}

export interface WindowShape {
  primary: string;
  sorted: boolean;
  ranged: boolean;
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

  async apply(changes: KeyChange[]): Promise<StreamChunk<Document>[]> {
    const latest = new Map(changes.map(change => [change.key, change.operation]));
    const deleted = [...latest]
      .filter(([, operation]) => operation == "delete")
      .map(([key]) => key);
    const touched = [...latest]
      .filter(([, operation]) => operation != "delete")
      .map(([key]) => key);
    const chunks: StreamChunk<Document>[] = [];

    for (const key of deleted) {
      if (this.ids.delete(key)) {
        chunks.push({kind: ChunkKind.Delete, document: this.keyDocument(key)});
      }
    }

    const matching = new Map(
      (touched.length ? await this.source.matching(touched) : []).map(document => [
        this.keyOf(document),
        document
      ])
    );
    const window = this.shape.sorted || this.shape.ranged ? await this.source.keys() : undefined;
    const inWindow = window && new Set(window);

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

    if (window) {
      chunks.push(...(await this.settle(window, inWindow)));
    }
    return chunks;
  }

  private async settle(window: string[], inWindow: Set<string>) {
    const chunks: StreamChunk<Document>[] = [];
    const entering = window.filter(key => !this.ids.has(key));
    for (const document of entering.length ? await this.source.matching(entering) : []) {
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
