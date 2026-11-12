import {ActivityModule} from "@spica-server/activity";
import {ChangeEmitter} from "@spica-server/bucket-hooks";
import {contractSuite} from "@spica-server/database-testing";
import {Action} from "@spica-server/interface-activity";
import {BucketApp, startBucketApp} from "../support/bucket-app";
import {IdentifiedUserModule} from "../support/test-user";
import {idOf} from "@spica-server/data";

contractSuite("BucketDataController: history, activity and hooks", engine => {
  let api: BucketApp;
  let bucketId: string;
  let key: "_id" | "id";
  let emitted: unknown[][];

  beforeEach(async () => {
    api = await startBucketApp(
      engine,
      {history: true, hooks: true},
      {imports: [IdentifiedUserModule, ActivityModule.forRoot({expireAfterSeconds: 60})]}
    );
    key = api.keyField;

    bucketId = idOf(
      await api.createBucket(
        {title: {type: "string"}, tags: {type: "array", items: {type: "string"}}},
        {title: "Tracked", description: "Tracked bucket", history: true}
      )
    );

    emitted = [];
    const emitter = api.module.get(ChangeEmitter, {strict: false});
    jest.spyOn(emitter, "emitChange").mockImplementation((options, documentKey, ...documents) => {
      emitted.push([options.type, documentKey, ...documents]);
    });
  });

  afterEach(() => api.close());

  const insert = async (document: object) =>
    (await api.req.post(`/bucket/${bucketId}/data`, document)).body;

  const eventually = async <T>(read: () => Promise<T>, done: (value: T) => boolean) => {
    let value = await read();
    for (let attempt = 0; attempt < 40 && !done(value); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      value = await read();
    }
    return value;
  };

  const histories = async (documentId: string) =>
    (await api.req.get(`/bucket/${bucketId}/history/${documentId}`)).body;

  const activities = async (documentId: string, expected: number) =>
    eventually(
      async () =>
        (await api.req.get("/activity", {resource: ["bucket", bucketId], documentId: [documentId]}))
          .body,
      found => found.length >= expected
    );

  describe("history", () => {
    it("should keep a history entry for each replacement and patch", async () => {
      const inserted = await insert({title: "first", tags: ["a"]});
      const documentId = inserted[key];
      expect(await histories(documentId)).toEqual([]);

      await api.req.put(`/bucket/${bucketId}/data/${documentId}`, {
        ...inserted,
        title: "second"
      });
      expect(await histories(documentId)).toHaveLength(1);

      await api.req.patch(`/bucket/${bucketId}/data/${documentId}`, {tags: ["a", "b"]});
      expect(await histories(documentId)).toHaveLength(2);
    });

    it("should restore the document as it was at a history entry", async () => {
      const inserted = await insert({title: "first", tags: ["a"]});
      const documentId = inserted[key];
      await api.req.put(`/bucket/${bucketId}/data/${documentId}`, {...inserted, title: "second"});
      await api.req.patch(`/bucket/${bucketId}/data/${documentId}`, {title: "third"});
      const entries = await histories(documentId);

      const restored = (
        await api.req.get(
          `/bucket/${bucketId}/history/${documentId}/${idOf(entries[entries.length - 1])}`
        )
      ).body;

      expect(restored).toMatchObject({title: "first", tags: ["a"]});
    });

    it("should clear the history of the whole bucket", async () => {
      const inserted = await insert({title: "first"});
      const documentId = inserted[key];
      await api.req.put(`/bucket/${bucketId}/data/${documentId}`, {...inserted, title: "second"});
      expect(await histories(documentId)).toHaveLength(1);

      const cleared = await api.req.delete(`/bucket/${bucketId}/history`);

      expect(cleared.statusCode).toBe(204);
      expect(await histories(documentId)).toEqual([]);
      const again = await api.req.delete(`/bucket/${bucketId}/history`).catch(e => e);
      expect(again.statusCode).toBe(404);
    });

    it("should drop the history of a document that is deleted", async () => {
      const inserted = await insert({title: "first"});
      const documentId = inserted[key];
      await api.req.put(`/bucket/${bucketId}/data/${documentId}`, {...inserted, title: "second"});
      expect(await histories(documentId)).toHaveLength(1);

      await api.req.delete(`/bucket/${bucketId}/data/${documentId}`);

      expect(await histories(documentId)).toEqual([]);
    });
  });

  describe("activity", () => {
    it("should record every write of a document", async () => {
      const inserted = await insert({title: "first"});
      const documentId = inserted[key];
      await api.req.put(`/bucket/${bucketId}/data/${documentId}`, {...inserted, title: "second"});
      await api.req.patch(`/bucket/${bucketId}/data/${documentId}`, {title: "third"});
      await api.req.delete(`/bucket/${bucketId}/data/${documentId}`);

      const found = await activities(documentId, 4);

      expect(found.map(activity => activity.action).sort()).toEqual(
        [Action.POST, Action.PUT, Action.PATCH, Action.DELETE].sort()
      );
      found.forEach(activity =>
        expect(activity.resource).toEqual(["bucket", bucketId, "data", documentId])
      );
    });
  });

  describe("hooks", () => {
    it("should announce every write with the document key and the documents", async () => {
      const inserted = await insert({title: "first"});
      const documentId = inserted[key];
      await api.req.put(`/bucket/${bucketId}/data/${documentId}`, {...inserted, title: "second"});
      await api.req.patch(`/bucket/${bucketId}/data/${documentId}`, {title: "third"});
      await api.req.delete(`/bucket/${bucketId}/data/${documentId}`);

      expect(emitted.map(([type, documentKey]) => [type, documentKey])).toEqual([
        ["insert", documentId],
        ["update", documentId],
        ["update", documentId],
        ["delete", documentId]
      ]);
      const [insertion, replacement, patch, deletion] = emitted;
      expect(insertion[3]).toMatchObject({title: "first"});
      expect(replacement[2]).toMatchObject({title: "first"});
      expect(replacement[3]).toMatchObject({title: "second"});
      expect(patch[3]).toMatchObject({title: "third"});
      expect(deletion[2]).toMatchObject({title: "third"});
    });

    it("should announce nothing for a write that is refused", async () => {
      await api.req.post(`/bucket/${bucketId}/data`, {title: 1}).catch(e => e);

      expect(emitted).toEqual([]);
    });
  });
});
