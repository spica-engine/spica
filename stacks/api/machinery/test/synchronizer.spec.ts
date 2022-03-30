import {Synchronizer, DocumentProvider, RepresentativeProvider} from "@spica-server/machinery";

describe("Synchronizer", () => {
  let synchronizer: Synchronizer;
  let repsProviders: RepresentativeProvider[] = [];
  let docsProviders: DocumentProvider[] = [];

  describe("unit", () => {
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

      repsProviders = [
        {
          module: "bucket",

          insert: jasmine.createSpy().and.callFake(d => Promise.resolve(d)),
          update: jasmine.createSpy().and.callFake(() => Promise.resolve()),
          delete: jasmine.createSpy().and.callFake(() => Promise.resolve()),

          getAll: jasmine.createSpy().and.callFake(() => {
            return Promise.resolve(reps);
          })
        }
      ];

      docsProviders = [
        {
          module: "bucket",

          insert: jasmine.createSpy().and.callFake(() => Promise.resolve()),
          update: jasmine.createSpy().and.callFake(() => Promise.resolve()),
          delete: jasmine.createSpy().and.callFake(() => Promise.resolve()),

          getAll: jasmine.createSpy().and.callFake(() => {
            return Promise.resolve(docs);
          })
        }
      ];

      synchronizer = new Synchronizer(repsProviders, docsProviders);
    });

    it("should synchronize module", async () => {
      await synchronizer.synchronize(["bucket"]);

      expect(repsProviders[0].getAll).toHaveBeenCalledTimes(1);
      expect(repsProviders[0].insert).toHaveBeenCalledOnceWith({
        _id: "3",
        title: "this representation should be inserted"
      });
      expect(repsProviders[0].update).toHaveBeenCalledOnceWith({
        _id: "1",
        title: "updated title"
      });
      expect(repsProviders[0].delete).toHaveBeenCalledOnceWith({
        _id: "2",
        title: "this representation should be deleted"
      });

      expect(docsProviders[0].getAll).toHaveBeenCalledTimes(1);
      expect(docsProviders[0].insert).not.toHaveBeenCalled();
      expect(docsProviders[0].update).not.toHaveBeenCalled();
      expect(docsProviders[0].delete).not.toHaveBeenCalled();
    });
  });

  describe("integration", () => {

  })

});
