import {ChunkKind, SequenceKind} from "@spica-server/interface-realtime";
import {KeyChange, RealtimeWindow, WindowSource} from "../../src/realtime/window.js";

type Row = {id: string; n: number; live: boolean};

class MemorySource implements WindowSource {
  readonly rows = new Map<string, Row>();
  matches = (row: Row) => row.live;
  order = (a: Row, b: Row) => a.id.localeCompare(b.id);
  skip = 0;
  limit?: number;
  calls = {matching: 0, keys: 0};

  put(id: string, n = 0, live = true) {
    this.rows.set(id, {id, n, live});
  }

  private window() {
    const rows = [...this.rows.values()].filter(this.matches).sort(this.order);
    return rows.slice(this.skip, this.limit === undefined ? undefined : this.skip + this.limit);
  }

  async documents() {
    return this.window();
  }

  async keys() {
    this.calls.keys++;
    return this.window().map(row => row.id);
  }

  async matching(keys: string[]) {
    this.calls.matching++;
    return [...this.rows.values()].filter(row => keys.includes(row.id) && this.matches(row));
  }
}

const change = (key: string, operation: KeyChange["operation"]): KeyChange => ({key, operation});

const summary = (chunks: {kind: ChunkKind; document?: any}[]) =>
  chunks.map(chunk => [ChunkKind[chunk.kind], chunk.document?.id]);

describe("RealtimeWindow", () => {
  let source: MemorySource;

  const open = async (shape: {sorted?: boolean; ranged?: boolean; relevant?: string[]} = {}) => {
    const window = new RealtimeWindow(source, {
      primary: "id",
      sorted: Boolean(shape.sorted),
      ranged: Boolean(shape.ranged),
      relevant: shape.relevant && new Set(shape.relevant)
    });
    await window.initial();
    return window;
  };

  beforeEach(() => {
    source = new MemorySource();
  });

  describe("initial", () => {
    it("should send every document and then mark the end", async () => {
      source.put("a");
      source.put("b");
      source.put("c", 0, false);
      const window = new RealtimeWindow(source, {primary: "id", sorted: false, ranged: false});

      expect(summary(await window.initial())).toEqual([
        ["Initial", "a"],
        ["Initial", "b"],
        ["EndOfInitial", undefined]
      ]);
    });

    it("should end right away when nothing matches", async () => {
      const window = new RealtimeWindow(source, {primary: "id", sorted: false, ranged: false});

      expect(summary(await window.initial())).toEqual([["EndOfInitial", undefined]]);
    });
  });

  describe("without a sort or a range", () => {
    it("should insert a document that matches", async () => {
      const window = await open();

      source.put("a");

      expect(summary(await window.apply([change("a", "insert")]))).toEqual([["Insert", "a"]]);
    });

    it("should ignore a document that does not match", async () => {
      const window = await open();

      source.put("a", 0, false);

      expect(await window.apply([change("a", "insert")])).toEqual([]);
    });

    it("should update a document the subscriber has", async () => {
      source.put("a");
      const window = await open();

      source.put("a", 5);

      expect(summary(await window.apply([change("a", "update")]))).toEqual([["Update", "a"]]);
    });

    it("should insert a document that starts to match", async () => {
      source.put("a", 0, false);
      const window = await open();

      source.put("a", 0, true);

      expect(summary(await window.apply([change("a", "update")]))).toEqual([["Insert", "a"]]);
    });

    it("should expunge a document that stops matching", async () => {
      source.put("a");
      const window = await open();

      source.put("a", 0, false);

      const chunks = await window.apply([change("a", "update")]);
      expect(chunks).toEqual([{kind: ChunkKind.Expunge, document: {id: "a"}}]);
    });

    it("should delete a document the subscriber has", async () => {
      source.put("a");
      const window = await open();

      source.rows.delete("a");

      const chunks = await window.apply([change("a", "delete")]);
      expect(chunks).toEqual([{kind: ChunkKind.Delete, document: {id: "a"}}]);
    });

    it("should say nothing about the delete of a document it never had", async () => {
      source.put("a", 0, false);
      const window = await open();

      source.rows.delete("a");

      expect(await window.apply([change("a", "delete")])).toEqual([]);
    });

    it("should follow the last change of a key in a batch", async () => {
      const window = await open();

      source.put("a");
      const inserted = await window.apply([change("a", "insert"), change("a", "update")]);
      source.rows.delete("a");
      const removed = await window.apply([change("a", "update"), change("a", "delete")]);

      expect(summary(inserted)).toEqual([["Insert", "a"]]);
      expect(summary(removed)).toEqual([["Delete", "a"]]);
    });

    it("should handle several keys of one batch", async () => {
      source.put("a");
      source.put("b");
      const window = await open();

      source.put("a", 1);
      source.rows.delete("b");
      source.put("c");

      const chunks = await window.apply([
        change("a", "update"),
        change("b", "delete"),
        change("c", "insert")
      ]);

      expect(chunks.map(chunk => ChunkKind[chunk.kind]).sort()).toEqual([
        "Delete",
        "Insert",
        "Update"
      ]);
    });

    it("should turn a repeated insert of a known key into an update", async () => {
      source.put("a");
      const window = await open();

      expect(summary(await window.apply([change("a", "insert")]))).toEqual([["Update", "a"]]);
    });
  });

  describe("with a limit", () => {
    beforeEach(() => {
      source.limit = 2;
      ["a", "b", "c"].forEach(id => source.put(id));
    });

    it("should ignore an insert beyond the limit", async () => {
      const window = await open({ranged: true});

      source.put("d");

      expect(await window.apply([change("d", "insert")])).toEqual([]);
    });

    it("should fill the gap a delete leaves with the next document", async () => {
      const window = await open({ranged: true});

      source.rows.delete("a");

      expect(summary(await window.apply([change("a", "delete")]))).toEqual([
        ["Delete", "a"],
        ["Initial", "c"]
      ]);
    });

    it("should fill the gap a document leaves by not matching any more", async () => {
      const window = await open({ranged: true});

      source.put("a", 0, false);

      const chunks = await window.apply([change("a", "update")]);
      expect(chunks).toEqual([
        {kind: ChunkKind.Expunge, document: {id: "a"}},
        {kind: ChunkKind.Initial, document: {id: "c", n: 0, live: true}}
      ]);
    });

    it("should expunge the document an earlier one pushes out", async () => {
      const window = await open({ranged: true});

      source.put("0");

      const chunks = await window.apply([change("0", "insert")]);
      expect(chunks).toEqual([
        {kind: ChunkKind.Insert, document: {id: "0", n: 0, live: true}},
        {kind: ChunkKind.Expunge, document: {id: "b"}}
      ]);
    });
  });

  describe("with a skip", () => {
    it("should expunge the document that shifts out when one before the window is deleted", async () => {
      source.skip = 1;
      ["a", "b", "c"].forEach(id => source.put(id));
      const window = await open({ranged: true});

      source.rows.delete("a");

      expect(summary(await window.apply([change("a", "delete")]))).toEqual([["Expunge", "b"]]);
    });
  });

  describe("with a sort", () => {
    beforeEach(() => {
      source.order = (a, b) => a.n - b.n;
      source.put("a", 1);
      source.put("b", 2);
      source.put("c", 3);
    });

    it("should say nothing about order when an update keeps it", async () => {
      const window = await open({sorted: true});

      source.put("b", 2.5);

      expect(summary(await window.apply([change("b", "update")]))).toEqual([["Update", "b"]]);
    });

    it("should send the new order when an update moves a document", async () => {
      const window = await open({sorted: true});

      source.put("a", 4);
      const chunks = await window.apply([change("a", "update")]);

      expect(chunks.map(chunk => ChunkKind[chunk.kind])).toEqual(["Update", "Order"]);
      expect(chunks[1].sequence.length).toBeGreaterThan(0);
    });

    it("should insert and then order a document that sorts first", async () => {
      const window = await open({sorted: true});

      source.put("z", 0);
      const chunks = await window.apply([change("z", "insert")]);

      expect(chunks.map(chunk => ChunkKind[chunk.kind])).toEqual(["Insert", "Order"]);
      expect(chunks[1].sequence.length).toBeGreaterThan(0);
      expect(await window.apply([change("a", "update")])).toEqual([
        expect.objectContaining({kind: ChunkKind.Update})
      ]);
    });

    it("should drop a document the limit pushes out through the order", async () => {
      source.limit = 3;
      const window = await open({sorted: true, ranged: true});

      source.put("z", 0);
      const chunks = await window.apply([change("z", "insert")]);

      expect(chunks.map(chunk => ChunkKind[chunk.kind])).toEqual(["Insert", "Order"]);
      expect(chunks[1].sequence).toEqual(
        expect.arrayContaining([expect.objectContaining({kind: SequenceKind.Delete, item: "c"})])
      );
    });

    it("should bring in the next document and order it after a delete", async () => {
      source.limit = 2;
      const window = await open({sorted: true, ranged: true});

      source.rows.delete("a");
      const chunks = await window.apply([change("a", "delete")]);

      expect(chunks.map(chunk => ChunkKind[chunk.kind])).toEqual(["Delete", "Initial"]);
    });

    it("should expunge a document that stops matching without an order chunk", async () => {
      const window = await open({sorted: true});

      source.put("b", 2, false);
      const chunks = await window.apply([change("b", "update")]);

      expect(chunks).toEqual([{kind: ChunkKind.Expunge, document: {id: "b"}}]);
    });
  });

  describe("updates that cannot matter", () => {
    const edit = (key: string, fields: string[] | undefined, row?: Partial<Row>) => ({
      key,
      operation: "update" as const,
      ...(fields && {fields}),
      document: {id: key, n: 0, live: true, ...row}
    });

    it("should send the document it was given without asking the source", async () => {
      source.put("a");
      const window = await open({relevant: ["live"]});

      const chunks = await window.apply([edit("a", ["n"], {n: 5})]);

      expect(chunks).toEqual([{kind: ChunkKind.Update, document: {id: "a", n: 5, live: true}}]);
      expect(source.calls).toEqual({matching: 0, keys: 0});
    });

    it("should say nothing about a key it does not have", async () => {
      source.put("a", 0, false);
      const window = await open({relevant: ["live"]});

      expect(await window.apply([edit("a", ["n"])])).toEqual([]);
      expect(source.calls).toEqual({matching: 0, keys: 0});
    });

    it("should ask the source when a field it depends on changed", async () => {
      source.put("a");
      const window = await open({relevant: ["live"]});

      source.put("a", 0, false);
      const chunks = await window.apply([edit("a", ["live"], {live: false})]);

      expect(chunks).toEqual([{kind: ChunkKind.Expunge, document: {id: "a"}}]);
      expect(source.calls.matching).toBe(1);
    });

    it("should ask the source when the key was inserted in the same batch", async () => {
      const window = await open({relevant: ["live"]});

      source.put("a");
      const chunks = await window.apply([change("a", "insert"), edit("a", ["n"])]);

      expect(summary(chunks)).toEqual([["Insert", "a"]]);
    });

    it("should ask the source when an update does not say what changed", async () => {
      source.put("a");
      const window = await open({relevant: ["live"]});

      await window.apply([change("a", "update")]);

      expect(source.calls.matching).toBe(1);
    });

    it("should ask the source when it does not know what matters", async () => {
      source.put("a");
      const window = await open();

      await window.apply([edit("a", ["n"])]);

      expect(source.calls.matching).toBe(1);
    });

    it("should leave a sorted window alone when no sort field changed", async () => {
      source.order = (a, b) => a.n - b.n;
      source.put("a", 1);
      source.put("b", 2);
      const window = await open({sorted: true, relevant: ["live", "n"]});

      const chunks = await window.apply([edit("a", ["title"])]);

      expect(summary(chunks)).toEqual([["Update", "a"]]);
      expect(source.calls).toEqual({matching: 0, keys: 0});
    });

    it("should recompute a sorted window when a sort field changed", async () => {
      source.order = (a, b) => a.n - b.n;
      source.put("a", 1);
      source.put("b", 2);
      const window = await open({sorted: true, relevant: ["live", "n"]});

      source.put("a", 3);
      const chunks = await window.apply([edit("a", ["n"], {n: 3})]);

      expect(chunks.map(chunk => ChunkKind[chunk.kind])).toEqual(["Update", "Order"]);
    });

    it("should still recompute a window for a delete", async () => {
      source.limit = 1;
      source.put("a");
      source.put("b");
      const window = await open({ranged: true, relevant: ["live"]});

      source.rows.delete("a");
      const chunks = await window.apply([change("a", "delete"), edit("b", ["n"])]);

      expect(summary(chunks)).toEqual([
        ["Delete", "a"],
        ["Initial", "b"]
      ]);
      expect(source.calls.keys).toBe(1);
    });

    it("should hand every recipient its own copy of the document", async () => {
      source.put("a");
      const window = await open({relevant: ["live"]});
      const given = edit("a", ["n"], {n: 5});

      const [chunk] = await window.apply([given]);
      (chunk.document as Row).n = 99;

      expect(given.document.n).toBe(5);
    });
  });
});
