import {PreferencesService, PreferencesMeta} from "./preferences.service";
import {HttpTestingController, HttpClientTestingModule} from "@angular/common/http/testing";
import {TestBed} from "@angular/core/testing";
import {of} from "rxjs";

let preferences: PreferencesMeta = {
  _id: "test",
  scope: "test",
  key: "test"
};

describe("PreferenceService", () => {
  let service: PreferencesService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PreferencesService]
    });

    service = TestBed.get(PreferencesService);
    httpTestingController = TestBed.get(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it("should be get request", () => {
    service.get("scope").subscribe();
    const req = httpTestingController.expectOne("api:/preference/scope");
    expect(req.request.method).toBe("GET");
  });
  it("should be post request", () => {
    service.insertOne(preferences).subscribe();
    const req = httpTestingController.expectOne("api:/preference");
    expect(req.request.method).toBe("POST");

    expect(req.request.body).toEqual(preferences);
  });

  it("should be put request", () => {
    service.replaceOne(preferences).subscribe();
    const req = httpTestingController.expectOne(`api:/preference/${preferences.scope}`);
    expect(req.request.method).toBe("PUT");

    expect(req.request.body).toEqual(preferences);
  });

  it("should return default value when there is no value on db", async () => {
    const originalGet = service["http"]["get"];
    const spy = (service["http"]["get"] = jasmine.createSpy("GET").and.returnValue(of(null)));
    expect(await service.get("scope", preferences).toPromise()).toBe(preferences);
    expect(spy).toHaveBeenCalledTimes(1);
    service["http"]["get"] = originalGet;
  });
});
