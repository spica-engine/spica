import {ComponentFixture, TestBed} from "@angular/core/testing";
import {of} from "rxjs";
import {MatLegacyCardModule as MatCardModule} from "@angular/material/legacy-card";
import {MatIconModule} from "@angular/material/icon";
import {MatButtonModule} from "@angular/material/button";
import {InputModule} from "@spica-client/common";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {CardComponent} from "./card.component";
import {FormsModule} from "@angular/forms";
import {PassportService} from "@spica-client/passport";
import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";

// @TODO: put here better tests after found a way to check the request which created by html form (queryParams, body etc.)
describe("CardComponent", () => {
  let component: CardComponent;
  let fixture: ComponentFixture<CardComponent>;

  let dashboardComponent;

  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CardComponent],
      imports: [
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        InputModule.withPlacers([]),
        FormsModule,
        NoopAnimationsModule,
        HttpClientTestingModule
      ],
      providers: [
        {
          provide: PassportService,
          useValue: {
            get token() {
              return "access_token";
            }
          }
        }
      ]
    }).compileComponents();

    httpTestingController = TestBed.get(HttpTestingController);

    dashboardComponent = {
      title: "Title of this dashboard component",
      description: "Description of this dashboard component",
      inputs: [
        {
          key: "topic",
          type: "string",
          value: "Cars",
          title: "Topic"
        },
        {
          key: "message",
          type: "string",
          value: "Bestseller car of this year has been announced..",
          title: "Message"
        },
        {
          key: "year",
          type: "number",
          value: 2000,
          title: "Year of this new"
        }
      ],
      button: {
        target: "dummy_url",
        method: "get",
        title: "Send Message"
      }
    };
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(CardComponent);
    component = fixture.componentInstance;

    component.componentData$ = of(dashboardComponent);

    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("should set form attributes for get request", () => {
    const form = fixture.debugElement.nativeElement.querySelector("form");
    expect(form.action).toEqual(window.location.origin + "/dummy_url");
    expect(form.method).toEqual("get");

    const submitSpy = spyOn(form, "submit");

    fixture.debugElement.nativeElement.querySelector("mat-card-actions > button").click();

    fixture.detectChanges();

    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("should set form attributes for post request", () => {
    dashboardComponent.button.method = "post";
    dashboardComponent.button.enctype = "multipart/form-data";

    fixture.detectChanges();

    const form = fixture.debugElement.nativeElement.querySelector("form");
    expect(form.action).toEqual(window.location.origin + "/dummy_url");
    expect(form.method).toEqual("post");
    expect(form.enctype).toEqual("multipart/form-data");

    const submitSpy = spyOn(form, "submit");

    fixture.debugElement.nativeElement.querySelector("mat-card-actions > button").click();

    fixture.detectChanges();

    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("should send post request with json body", () => {
    dashboardComponent.button.method = "post";
    dashboardComponent.button.enctype = "application/json";

    fixture.detectChanges();

    fixture.debugElement.nativeElement.querySelector("mat-card-actions > button").click();

    fixture.detectChanges();

    const testreq = httpTestingController.expectOne("dummy_url");
    expect(testreq.request.method).toEqual("POST");
    expect(testreq.request.headers.get("Authorization")).toEqual("access_token");
    expect(testreq.request.body).toEqual({
      topic: "Cars",
      message: "Bestseller car of this year has been announced..",
      // it should be sent as number
      year: 2000
    });
  });
});
