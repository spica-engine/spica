import {SyncDirection, Synchronizer, SyncProvider} from "@spica-server/versioncontrol";

describe("Synchronizer", () => {
  let synchronizer: Synchronizer;
  let syncProvider: SyncProvider;

  const now = new Date();

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
        insert: jest.fn(d => Promise.resolve(d)),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve()),

        getAll: jest.fn(() => {
          return Promise.resolve(reps);
        })
      },

      document: {
        insert: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve()),

        getAll: jest.fn(() => {
          return Promise.resolve(docs);
        })
      }
    };

    synchronizer = new Synchronizer();

    synchronizer.register(syncProvider);

    jest.useFakeTimers().setSystemTime(now);
  });

  it("should get last sync", async () => {
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

  it("should prioritize modules by parent count while synchronizing", async () => {
    const subSyncProvider = {...syncProvider};
    subSyncProvider.name = "submodule";
    subSyncProvider.parents = 1;

    // synchronizer.register() method will push this provider at the end of array,
    // but we want to make sure that submodule synchronized last because of prioritizing logic
    synchronizer["providers"].unshift(subSyncProvider);

    const lastSync = await synchronizer.synchronize(SyncDirection.RepToDoc);

    expect(lastSync).toEqual(
      {
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
          },
          {
            module: "submodule",
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
      }
    );
  });
});
