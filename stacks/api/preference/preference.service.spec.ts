import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId, DatabaseService} from "@spica-server/database/testing";
import {PreferenceService} from "./preference.service";
import {Preference} from "./interface";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

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
      imports: [DatabaseTestingModule.create()],
      providers: [PreferenceService]
    }).compile();
    preferenceService = module.get(PreferenceService);
  });

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

  it("should get passport preferences", async () => {
    const passportPref = await preferenceService.get("passport");

    expect(passportPref.scope).toBe("passport");
    expect(passportPref.property).toBe("passport property");
  });

  it("should get default preference if scope doesnt exist but default exist", async () => {
    await preferenceService.default({scope: "function", property: "default function property"});
    const functionPref = await preferenceService.get("function");

    expect(functionPref.scope).toBe("function");
    expect(functionPref.property).toBe("default function property");
  });

  it("should update bucket preferences", async () => {
    await preferenceService.update({
      scope: "bucket",
      property: "new property for bucket"
    });

    const bucketPref = await preferenceService.get("bucket");

    expect(bucketPref.scope).toBe("bucket");
    expect(bucketPref.property).toBe("new property for bucket");
  });

  it("should add new preference if it doesnt exist", async () => {
    await preferenceService.update({
      scope: "function",
      property: "function property"
    });

    const functionPref = await preferenceService.get("function");

    expect(functionPref.scope).toBe("function");
    expect(functionPref.property).toBe("function property");
  });

  //get info about mongo watcher the write 'watch' test
});
