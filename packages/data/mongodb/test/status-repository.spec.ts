import {Test} from "@nestjs/testing";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database-testing";
import {MongoStatusRepository} from "@spica-server/data-mongodb";
import {STATUS_OPTIONS} from "@spica-server/interface-status";

describe("MongoStatusRepository", () => {
  let service: MongoStatusRepository;
  let db: DatabaseService;
  let statusCollection;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [
        MongoStatusRepository,
        {
          provide: STATUS_OPTIONS,
          useValue: {expireAfterSeconds: 60 * 60}
        }
      ]
    }).compile();

    service = module.get(MongoStatusRepository);
    db = module.get(DatabaseService);
    statusCollection = db.collection("status");
  });

  afterEach(async () => {
    await statusCollection.deleteMany({});
  });

  describe("Per-minute aggregation", () => {
    it("should set created_at once so the TTL index can expire the document", async () => {
      const payload = {request: {size: 1}, response: {size: 1}};
      await service.insertOne(payload);
      const [first] = await statusCollection.find({}).toArray();

      await service.insertOne(payload);
      const docs = await statusCollection.find({}).toArray();

      expect(docs.length).toBe(1);
      expect(first.created_at).toBeInstanceOf(Date);
      expect(docs[0].created_at).toEqual(first.created_at);
    });

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
        created_at: expect.any(Date),
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
        created_at: expect.any(Date),
        count: 1,
        request: {size: 1000},
        response: {size: 2000}
      });

      expect(docs[1]).toEqual({
        _id: minute2ObjectId,
        created_at: expect.any(Date),
        count: 2,
        request: {size: 2700}, // 1500 + 1200
        response: {size: 4700} // 2500 + 2200
      });
    });
  });
});
