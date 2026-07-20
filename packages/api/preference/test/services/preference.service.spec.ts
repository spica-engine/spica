import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database-testing";
import {PreferenceService, PreferenceChangeDispatcher} from "@spica-server/preference-services";
import {Preference} from "@spica-server/interface-preference";
import {Observable} from "rxjs";
import {take} from "rxjs/operators";

describe("Preference Service", () => {
  async function addPref(prefs: Preference[]) {
    await module.get(DatabaseService).collection("preferences").insertMany(prefs);
  }

  let module: TestingModule;
  let preferenceService: PreferenceService;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [PreferenceService, PreferenceChangeDispatcher]
    }).compile();
    preferenceService = module.get(PreferenceService);
  }, 120000);

  beforeEach(async () => {
    // clear prefs
    await module.get(DatabaseService).collection("preferences").deleteMany({});

    // add prefs
    const prefs: Preference[] = [
      {scope: "bucket", property: "bucket property"},
      {scope: "passport", property: "passport property"}
    ];
    await addPref(prefs);
  });

  afterEach(() => jest.restoreAllMocks());

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
      const obs = preferenceService.watchPreference("bucket");
      expect(obs instanceof Observable).toBe(true);
    });

    it("should return pref when called with propageOnStart is true", done => {
      preferenceService
        .watchPreference("bucket", {propagateOnStart: true})
        .pipe(take(1))
        .subscribe(next => {
          expect(next.scope).toBe("bucket");
          expect(next.property).toBe("bucket property");
          done();
        });
    });

    it("should return updated pref when pref value updated on db", done => {
      preferenceService
        .watchPreference("bucket")
        .pipe(take(1))
        .subscribe(next => {
          expect(next.scope).toBe("bucket");
          expect(next.property).toBe("updated bucket property");
          done();
        });

      preferenceService
        .replace({scope: "bucket"}, {scope: "bucket", property: "updated bucket property"})
        .catch();
    });

    it("should keep propagating after a reload fails", done => {
      const coll = (preferenceService as any)._coll;
      const findOne = coll.findOne.bind(coll);
      let alreadyFailed = false;

      jest.spyOn((preferenceService as any).logger, "error").mockImplementation(() => {});
      jest.spyOn(coll, "findOne").mockImplementation((...args) => {
        if (!alreadyFailed) {
          alreadyFailed = true;
          return Promise.reject(new Error("transient failure"));
        }
        return findOne(...args);
      });

      preferenceService
        .watchPreference("bucket")
        .pipe(take(1))
        .subscribe(next => {
          expect(next.property).toBe("second update");
          done();
        });

      preferenceService
        .replace({scope: "bucket"}, {scope: "bucket", property: "first update"})
        .then(() =>
          preferenceService.replace({scope: "bucket"}, {scope: "bucket", property: "second update"})
        )
        .catch();
    });
  });
});
