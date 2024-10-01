import {checkDocument, checkDocuments} from "@spica-devkit/database/src/check";
import {ObjectId} from "mongodb";

describe("Checks", () => {
  let emitWarning: jasmine.Spy<typeof process.emitWarning>;
  beforeEach(() => {
    emitWarning = spyOn(process, "emitWarning");
  });

  describe("checkDocument", () => {
    it("should not emit a warning when _id property contains an objectid", () => {
      const doc = {
        _id: new ObjectId()
      };
      checkDocument(doc);
      expect(emitWarning).not.toHaveBeenCalled();
    });

    it("should emit a warning when a property contains an objectid", () => {
      const doc = {
        _id: new ObjectId(),
        other_than_id: new ObjectId()
      };
      checkDocument(doc);
      expect(emitWarning).toHaveBeenCalledWith(
        `Property in the document path 'other_than_id' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should emit a warning when a property in a subdocument contains an objectid", () => {
      const doc = {
        _id: new ObjectId(),
        calls: {
          _id: new ObjectId()
        }
      };
      checkDocument(doc);
      expect(emitWarning).toHaveBeenCalledWith(
        `Property in the document path 'calls._id' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should emit a warning when a property in a array of subdocument contains an objectid", () => {
      const doc = {
        _id: new ObjectId(),
        calls: [
          {
            _id: new ObjectId()
          }
        ]
      };
      checkDocument(doc);
      expect(emitWarning).toHaveBeenCalledWith(
        `Property in the document path 'calls.0._id' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });

    it("should emit a warning when a property in a array contains any objectid", () => {
      const doc = {
        _id: new ObjectId(),
        calls: [new ObjectId(), new ObjectId()]
      };
      checkDocument(doc);
      expect(emitWarning).toHaveBeenCalledWith(
        `Property in the document path 'calls.0' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
      expect(emitWarning).toHaveBeenCalledWith(
        `Property in the document path 'calls.1' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });
  });

  describe("checkDocuments", () => {
    it("should not emit a warning when _id property contains an objectid", () => {
      const docs = [
        {
          _id: new ObjectId()
        },
        {
          _id: new ObjectId()
        }
      ];
      checkDocuments(docs);
      expect(emitWarning).not.toHaveBeenCalled();
    });

    it("should emit a warning when a property contains an objectid", () => {
      const docs = [
        {
          _id: new ObjectId(),
          other_than_id: new ObjectId()
        },
        {
          _id: new ObjectId(),
          other_than_id: new ObjectId()
        }
      ];
      checkDocuments(docs);
      expect(emitWarning).toHaveBeenCalledWith(
        `Property in the document path '0.other_than_id' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
      expect(emitWarning).toHaveBeenCalledWith(
        `Property in the document path '1.other_than_id' contains an ObjectId value.\n` +
          `This may lead to some inconsistencies within the system.\n` +
          `You may want to cast it to string before using it.`
      );
    });
  });
});
