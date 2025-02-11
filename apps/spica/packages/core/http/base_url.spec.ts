import {TestBed} from "@angular/core/testing";
import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";

import {BaseUrlInterceptor} from "./base_url.interceptor";
import {HTTP_INTERCEPTORS, HttpClient} from "@angular/common/http";
import {BASE_URL} from "./base_url";

describe(`HttpInterceptor`, () => {
  let service: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: HTTP_INTERCEPTORS,
          useExisting: BaseUrlInterceptor,
          multi: true
        },
        {
          provide: BaseUrlInterceptor,
          useValue: new BaseUrlInterceptor({api: "http://customdomain"}),
          deps: [BASE_URL]
        }
      ]
    });

    service = TestBed.get(HttpClient);
    httpTesting = TestBed.get(HttpTestingController);
  });

  it("should replace base url", () => {
    service.get("api:/myurl").toPromise();
    let testRequest = httpTesting.expectOne("http://customdomain/myurl");
    expect(testRequest).toBeTruthy();
    expect(testRequest.request.headers.get("X-Not-Api")).toBe(null);
  });

  it("should not replace base url if theres no match", () => {
    service.get("microapi:/mydoamin/te").toPromise();
    let testRequest = httpTesting.expectOne("microapi:/mydoamin/te");
    expect(testRequest).toBeTruthy();
    expect(testRequest.request.headers.get("X-Not-Api")).toBe("true");
  });

  it("should not replace base url", () => {
    service.get("http://customdomain/test123").toPromise();
    let testRequest = httpTesting.expectOne("http://customdomain/test123");
    expect(testRequest).toBeTruthy();
    expect(testRequest.request.headers.get("X-Not-Api")).toBe("true");
  });
});
