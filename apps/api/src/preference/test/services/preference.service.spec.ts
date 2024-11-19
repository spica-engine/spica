import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica/database";
import {Preference, PreferenceService} from "@spica-server/preference/services";
import {Observable} from "rxjs";
import {take} from "rxjs/operators";

describe("Preference Service", () => {
  async function addPref(prefs: Preference[]) {
    await module
      .get(DatabaseService)
      .collection("preferences")
      .insertMany(prefs);
  }

  let module: TestingModule;
  let preferenceService: PreferenceService;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [PreferenceService]
    }).compile();
    preferenceService = module.get(PreferenceService);
  }, 120000);

  beforeEach(async () => {
    // clear prefs
    await module
      .get(DatabaseService)
      .collection("preferences")
      .deleteMany({});

    // add prefs
    const prefs: Preference[] = [
      {scope: "bucket", property: "bucket property"},
      {scope: "passport", property: "passport property"}
    ];
    await addPref(prefs);
  });

  afterAll(async () => {
    await module.close();
  });

  it("should get passport preferences", async () => {
    const passportPref = await preferenceService.get("passport");

    expect(passportPref.scope).toBe("passport");
    expect(passportPref.property).toBe("passport property");
  });

  it("should get default preference if scope doesnt exist but default exists", async () => {
    await preferenceService.default({scope: "function", property: "default function property"});
    const functionPref = await preferenceService.get("function");

    expect(functionPref.scope).toBe("function");
    expect(functionPref.property).toBe("default function property");
  });

  it("should update preference", async () => {
    const insertedPref = await preferenceService.insertOne({scope: "test"});
    await preferenceService.replace(
      {_id: insertedPref._id},
      {
        scope: "test",
        property: "new property for test"
      }
    );

    const pref = await preferenceService.get("test");

    expect(pref.scope).toBe("test");
    expect(pref.property).toBe("new property for test");
  });

  it("should add new preference", async () => {
    await preferenceService.insertOne({
      scope: "function",
      property: "function property"
    });

    const functionPref = await preferenceService.get("function");

    expect(functionPref._id).toBeDefined();
    expect(functionPref.scope).toBe("function");
    expect(functionPref.property).toBe("function property");
  });

  describe("watch requests", () => {
    it("should return observable when called with propageOnStart is false", () => {
      const obs = preferenceService.watch("bucket");
      expect(obs instanceof Observable).toBe(true);
    });

    it("should return pref when called with propageOnStart is true", done => {
      preferenceService
        .watch("bucket", {propagateOnStart: true})
        .pipe(take(1))
        .subscribe(next => {
          expect(next.scope).toBe("bucket");
          expect(next.property).toBe("bucket property");
          done();
        });
    });

    it("should return updated pref when pref value updated on db", done => {
      preferenceService
        .watch("bucket")
        .pipe(take(1))
        .subscribe(next => {
          expect(next.scope).toBe("bucket");
          expect(next.property).toBe("updated bucket property");
          done();
        });

      setTimeout(() => {
        preferenceService
          .updateOne({scope: "bucket"}, {$set: {property: "updated bucket property"}})
          .catch();
      }, 100);
    });
  });
});
