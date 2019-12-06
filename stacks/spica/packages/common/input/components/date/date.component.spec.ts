import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatFormFieldModule, MatInputModule, MatMenuModule} from "@angular/material";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {OwlDateTimeModule, OwlNativeDateTimeModule} from "ng-pick-datetime";
import {INPUT_SCHEMA} from "../../input";
import {DateComponent} from "./date.component";

describe("Common#date", () => {
  let fixture: ComponentFixture<DateComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [
          FormsModule,
          MatFormFieldModule,
          MatInputModule,
          MatMenuModule,
          OwlDateTimeModule,
          OwlNativeDateTimeModule,
          NoopAnimationsModule
        ],
        declarations: [DateComponent],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "date",
              $name: "test"
            }
          }
        ]
      })
      .compileComponents();
    fixture = TestBed.createComponent(DateComponent);
    fixture.detectChanges();
  });

  describe("basic behavior", () => {
    it("should create and set the model name", () => {
      const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
      expect(input.path).toEqual(["test"]);
    });

    it("should show name as title if title is undefined", () => {
      fixture.componentInstance.schema.title = undefined;
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-label")).nativeElement.textContent).toBe(
        "test"
      );
    });

    it("should show title", () => {
      const title = (fixture.componentInstance.schema.title = "my title");
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-label")).nativeElement.textContent).toBe(title);
    });

    it("should show description if provided", () => {
      expect(fixture.debugElement.query(By.css("mat-hint"))).toBeNull();
      const description = (fixture.componentInstance.schema.description = "my long description");
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-hint")).nativeElement.textContent).toBe(
        description
      );
    });

    it("should be valid pristine and untouched", () => {
      const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
      expect(formFieldElem.classList).toContain("ng-untouched");
      expect(formFieldElem.classList).toContain("ng-pristine");
      expect(formFieldElem.classList).toContain("ng-valid");
    });

    it("should open picker on click", () => {
      expect(document.body.querySelector("owl-date-time-container")).toBeNull();
      const input = fixture.debugElement.query(By.css("input"));
      input.nativeElement.click();
      expect(document.body.querySelector("owl-date-time-container")).toBeDefined();
    });
  });
});
