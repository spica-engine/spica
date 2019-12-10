import {TestBed, fakeAsync} from "@angular/core/testing";
import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";
import {HTTP_INTERCEPTORS, HttpClient} from "@angular/common/http";
import {ErrorInterceptor} from "./error.interceptor";
import {Router} from "@angular/router";

describe("Error Interceptor", () => {
  let service: HttpClient;
  let httpTesting: HttpTestingController;

  let mockRouter = jasmine.createSpyObj("Router", ["navigate"]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ErrorInterceptor,
        {
          provide: HTTP_INTERCEPTORS,
          useClass: ErrorInterceptor,
          multi: true
        },
        {
          provide: Router,
          useValue: mockRouter
        }
      ]
    });

    service = TestBed.get(HttpClient);
    httpTesting = TestBed.get(HttpTestingController);
  });

  it("should navigate to error page with these queryParams", fakeAsync(() => {
    service
      .get("testurl")
      .toPromise()
      .catch(err => {
        expect(mockRouter.navigate).toHaveBeenCalledWith(["/error"], routerData);
        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
        mockRouter.navigate.calls.reset();
      });
    httpTesting
      .expectOne("testurl")
      .flush({message: "error message"}, {status: 403, statusText: "status text"});
    let routerData = {
      queryParams: {
        message: "error message",
        status: 403,
        statusText: "status text"
      }
    };
  }));

  it("shouldn't navigate to error page if status code isn't 403", fakeAsync(() => {
    service
      .get("testurl")
      .toPromise()
      .catch(err => {});
    httpTesting
      .expectOne("testurl")
      .flush({message: "error message"}, {status: 500, statusText: "status text"});
    expect(mockRouter.navigate).toHaveBeenCalledTimes(0);
    mockRouter.navigate.calls.reset();
  }));
});
