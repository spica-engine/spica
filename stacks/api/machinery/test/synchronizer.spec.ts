import {Synchronizer, DocumentProvider, RepresentativeProvider} from "@spica-server/machinery";

describe("Synchronizer", () => {
  let synchronizer: Synchronizer;
  let repsProvider: RepresentativeProvider;
  let docsProvider: DocumentProvider;

  beforeEach(() => {
    const reps = [
      {
        _id: "1",
        title: "this representation should be updated"
      },
      {
        _id: "2",
        title: "this representation should be deleted"
      }
    ];

    const docs = [
      {
        _id: "1",
        title: "updated title"
      },
      {
        _id: "3",
        title: "this representation should be inserted"
      }
    ];

    repsProvider = {
      module: "bucket",

      insert: jasmine.createSpy().and.callFake(d => Promise.resolve(d)),
      update: jasmine.createSpy().and.callFake(() => Promise.resolve()),
      delete: jasmine.createSpy().and.callFake(() => Promise.resolve()),

      getAll: jasmine.createSpy().and.callFake(() => {
        return Promise.resolve(reps);
      })
    };

    docsProvider = {
      module: "bucket",

      insert: jasmine.createSpy().and.callFake(() => Promise.resolve()),
      update: jasmine.createSpy().and.callFake(() => Promise.resolve()),
      delete: jasmine.createSpy().and.callFake(() => Promise.resolve()),

      getAll: jasmine.createSpy().and.callFake(() => {
        return Promise.resolve(docs);
      })
    };

    synchronizer = new Synchronizer();
    synchronizer.register(repsProvider, docsProvider);
  });

  it("should synchronize module", async () => {
    await synchronizer.synchronize(["bucket"]);

    expect(repsProvider.getAll).toHaveBeenCalledTimes(1);
    expect(repsProvider.insert).toHaveBeenCalledOnceWith({
      _id: "3",
      title: "this representation should be inserted"
    });
    expect(repsProvider.update).toHaveBeenCalledOnceWith({
      _id: "1",
      title: "updated title"
    });
    expect(repsProvider.delete).toHaveBeenCalledOnceWith({
      _id: "2",
      title: "this representation should be deleted"
    });

    expect(docsProvider.getAll).toHaveBeenCalledTimes(1);
    expect(docsProvider.insert).not.toHaveBeenCalled();
    expect(docsProvider.update).not.toHaveBeenCalled();
    expect(docsProvider.delete).not.toHaveBeenCalled();
  });
});
