import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {of} from "rxjs";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatButtonModule} from "@angular/material/button";
import {InputModule} from "@spica-client/common";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {CardComponent} from "./card.component";
import {FormsModule, NgModel} from "@angular/forms";
import {By} from "@angular/platform-browser";
import {HttpParams} from "@angular/common/http";

describe("CardComponent", () => {
  let component: CardComponent;
  let fixture: ComponentFixture<CardComponent>;

  let dashboardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CardComponent],
      imports: [
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        InputModule.withPlacers([]),
        FormsModule,
        NoopAnimationsModule
      ]
    }).compileComponents();

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

  it("should send default inputs", () => {
    const inputValues = Array.from(
      fixture.debugElement.nativeElement.querySelectorAll("mat-card-content.inputs > span > input")
    ).map((i: any) => i.value);

    expect(inputValues).toEqual(["Cars", "Bestseller car of this year has been announced.."]);

    const form = fixture.debugElement.nativeElement.querySelector("form");

    const submitSpy = spyOn(form, "submit");

    fixture.debugElement.nativeElement.querySelector("mat-card-actions > button").click();

    fixture.detectChanges();

    const params = new HttpParams({
      fromObject: {
        topic: "Cars",
        message: "Bestseller car of this year has been announced.."
      }
    });
    const url = window.location.origin + "/dummy_url?" + params.toString();

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(form.action).toEqual(url.toString());
  });

  it("should send get request", () => {
    const models = fixture.debugElement
      .queryAll(By.directive(NgModel))
      .map(el => el.injector.get(NgModel));

    const topic = models.find(m => m.name == "topic");
    const message = models.find(m => m.name == "message");

    topic.control.setValue("Health");
    message.control.setValue("5 Tips for burning calories");

    fixture.detectChanges();

    const form = fixture.debugElement.nativeElement.querySelector("form");
    const submitSpy = spyOn(form, "submit");

    fixture.debugElement.nativeElement.querySelector("mat-card-actions > button").click();

    fixture.detectChanges();

    expect(submitSpy).toHaveBeenCalledTimes(1);

    const params = new HttpParams({
      fromObject: {
        topic: "Health",
        message: "5 Tips for burning calories"
      }
    });
    const url = window.location.origin + "/dummy_url?" + params.toString();

    expect(form.action).toEqual(url.toString());
    expect(form.method).toEqual("get");
  });

  it("should send post request", () => {
    dashboardComponent.button.method = "post";

    fixture.detectChanges();

    const models = fixture.debugElement
      .queryAll(By.directive(NgModel))
      .map(el => el.injector.get(NgModel));

    const topic = models.find(m => m.name == "topic");
    const message = models.find(m => m.name == "message");

    topic.control.setValue("Health");
    message.control.setValue("5 Tips for burning calories");

    fixture.detectChanges();

    const form = fixture.debugElement.nativeElement.querySelector("form");

    const submitSpy = spyOn(form, "submit");

    fixture.debugElement.nativeElement.querySelector("mat-card-actions > button").click();

    fixture.detectChanges();

    expect(submitSpy).toHaveBeenCalledTimes(1);

    const params = new HttpParams({
      fromObject: {
        topic: "Health",
        message: "5 Tips for burning calories"
      }
    });
    const url = window.location.origin + "/dummy_url?" + params.toString();

    expect(form.action).toEqual(url.toString());
    expect(form.method).toEqual("post");
  });
});
