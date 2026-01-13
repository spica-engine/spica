import {Test} from "@nestjs/testing";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database/testing";
import {StatusService} from "../src/service";
import {STATUS_OPTIONS} from "@spica-server/interface/status";

describe("StatusService", () => {
  let service: StatusService;
  let db: DatabaseService;
  let statusCollection;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [
        StatusService,
        {
          provide: STATUS_OPTIONS,
          useValue: {expireAfterSeconds: 60 * 60}
        }
      ]
    }).compile();

    service = module.get(StatusService);
    db = module.get(DatabaseService);
    statusCollection = db.collection("status");
  });

  afterEach(async () => {
    await statusCollection.deleteMany({});
  });

  describe("Per-minute aggregation", () => {
    it("should aggregate multiple requests in the same minute into a single document", async () => {
      await service.insertOne({
        request: {size: 1000},
        response: {size: 2000}
      });

      await service.insertOne({
        request: {size: 1500},
        response: {size: 2500}
      });

      await service.insertOne({
        request: {size: 1200},
        response: {size: 2200}
      });

      const docs = await statusCollection.find({}).toArray();

      expect(docs.length).toBe(1);

      expect(docs[0]).toEqual({
        _id: docs[0]._id,
        count: 3,
        request: {size: 3700}, // 1000 + 1500 + 1200
        response: {size: 6700} // 2000 + 2500 + 2200
      });
    });

    it("should create separate documents for requests in different minutes", async () => {
      const minute1ObjectId = service.getCurrentMinuteObjectId();

      await service.insertOne({
        request: {size: 1000},
        response: {size: 2000}
      });

      const nextMinuteDate = new Date(Date.now() + 60000);
      const minute2ObjectId = service.objectIdFromDate(nextMinuteDate);

      jest.spyOn(service, "getCurrentMinuteObjectId").mockReturnValue(minute2ObjectId);

      await service.insertOne({
        request: {size: 1500},
        response: {size: 2500}
      });

      await service.insertOne({
        request: {size: 1200},
        response: {size: 2200}
      });

      const docs = await statusCollection.find({}).sort({_id: 1}).toArray();

      expect(docs.length).toBe(2);

      expect(docs[0]).toEqual({
        _id: minute1ObjectId,
        count: 1,
        request: {size: 1000},
        response: {size: 2000}
      });

      expect(docs[1]).toEqual({
        _id: minute2ObjectId,
        count: 2,
        request: {size: 2700}, // 1500 + 1200
        response: {size: 4700} // 2500 + 2200
      });
    });
  });
});
