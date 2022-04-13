import {SyncDirection, Synchronizer, SyncProvider} from "@spica-server/versioncontrol";

describe("Synchronizer", () => {
  let synchronizer: Synchronizer;
  let syncProvider: SyncProvider;

  beforeEach(() => {
    const reps = [
      {
        _id: "1",
        title: "this representation should be updated"
      },
      {
        _id: "2",
        title: "this representation should be inserted"
      }
    ];

    const docs = [
      {
        _id: "1",
        title: "updated title"
      },
      {
        _id: "3",
        title: "this representation should be deleted"
      }
    ];

    syncProvider = {
      parents: 0,
      name: "bucket",
      representative: {
        insert: jasmine.createSpy().and.callFake(d => Promise.resolve(d)),
        update: jasmine.createSpy().and.callFake(() => Promise.resolve()),
        delete: jasmine.createSpy().and.callFake(() => Promise.resolve()),

        getAll: jasmine.createSpy().and.callFake(() => {
          return Promise.resolve(reps);
        })
      },

      document: {
        insert: jasmine.createSpy().and.callFake(() => Promise.resolve()),
        update: jasmine.createSpy().and.callFake(() => Promise.resolve()),
        delete: jasmine.createSpy().and.callFake(() => Promise.resolve()),

        getAll: jasmine.createSpy().and.callFake(() => {
          return Promise.resolve(docs);
        })
      }
    };

    synchronizer = new Synchronizer();

    synchronizer.register(syncProvider);
  });

  it("should get last sync", async () => {
    const now = new Date();
    jasmine.clock().mockDate(now);

    const lastSync = await synchronizer.synchronize(SyncDirection.RepToDoc);

    expect(lastSync).toEqual({
      resources: [
        {
          module: "bucket",
          insertions: [{_id: "2", title: "this representation should be inserted"}],
          updations: [
            {
              _id: "1",
              title: "this representation should be updated"
            }
          ],
          deletions: [
            {
              _id: "3",
              title: "this representation should be deleted"
            }
          ]
        }
      ],
      date: now.toISOString()
    });
  });
});
