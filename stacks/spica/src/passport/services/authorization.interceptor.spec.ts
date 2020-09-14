import {HttpClient, HTTP_INTERCEPTORS} from "@angular/common/http";
import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";
import {TestBed} from "@angular/core/testing";
import {AuthorizationInterceptor} from "./authorization.interceptor";
import {PassportService} from "./passport.service";

describe("AuthorizationInterceptor", () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let passportService: Partial<PassportService> = {};

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: HTTP_INTERCEPTORS,
          useExisting: AuthorizationInterceptor,
          multi: true
        }
      ]
    });

    TestBed.overrideProvider(PassportService, {useValue: passportService});

    httpClient = TestBed.get(HttpClient);
    httpTesting = TestBed.get(HttpTestingController);
  });

  it("should set authorization header", () => {
    passportService.token = "test";
    httpClient.get("api:/testt").toPromise();
    const req = httpTesting.expectOne("api:/testt");
    expect(req.request.headers.get("authorization")).toBe("test");
  });

  it("should not set authorization header if token is undefined", () => {
    passportService.token = undefined;
    httpClient.get("api:/test").toPromise();
    const req = httpTesting.expectOne("api:/test");
    expect(req.request.headers.get("authorization")).toBe(null);
  });

  it("should not set authorization header if request headers has X-Not-Api, and remove the X-Not-Api", () => {
    passportService.token = "test";
    httpClient.get("different_domain/test", {headers: {"X-Not-Api": "true"}}).toPromise();
    const req = httpTesting.expectOne("different_domain/test");
    expect(req.request.headers.get("authorization")).toBe(null);
    expect(req.request.headers.get("X-Not-Api")).toBe(null);
  });
});
