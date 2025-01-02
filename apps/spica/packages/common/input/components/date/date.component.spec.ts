import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {OwlDateTimeModule, OwlNativeDateTimeModule} from "@danielmoncada/angular-datetime-picker";
import {INPUT_SCHEMA} from "../../input";
import {DateComponent} from "./date.component";
import {DateValidatorDirective} from "./date.validator";
import {MatLegacyFormFieldHarness as MatFormFieldHarness} from "@angular/material/legacy-form-field/testing";
import {HarnessLoader} from "@angular/cdk/testing";
import {TestbedHarnessEnvironment} from "@angular/cdk/testing/testbed";
import {MatIconModule} from "@angular/material/icon";

describe("Common#date", () => {
  let fixture: ComponentFixture<DateComponent>;
  let loader: HarnessLoader;

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
          NoopAnimationsModule,
          MatIconModule
        ],
        declarations: [DateComponent, DateValidatorDirective],
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
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  describe("basic behavior", () => {
    it("should create and set the model name", () => {
      const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
      expect(input.path).toEqual(["test"]);
    });

    it("should show title", () => {
      const title = (fixture.componentInstance.schema.title = "my title");
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-label")).nativeElement.textContent).toBe(title);
    });

    xit("should show gmt date", async () => {
      const model = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
      model.control.setValue(new Date("Aug 26, 2020, 10:23:26 AM"), {emitEvent: true});
      fixture.detectChanges();
      const field = await loader.getHarness(MatFormFieldHarness);
      const [hint] = await field.getTextHints();
      expect(hint).toBe("Aug 26, 2020, 7:23:26 AM help");
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

    it("should progpagate undefined when the date is not valid", () => {
      const input = fixture.debugElement.query(By.css("input"));
      const changeSpy = spyOn(fixture.componentInstance, "_onChangeFn");
      expect(changeSpy).not.toHaveBeenCalled();
      input.triggerEventHandler("keyup", {
        keyCode: 8
      });
      expect(changeSpy).toHaveBeenCalledTimes(1);
      expect(changeSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe("errors", () => {
    it("should show date validation errors", () => {
      const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
      input.control.setValue("invalid date");
      input.control.markAsTouched();
      fixture.detectChanges();
      const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
      expect(formFieldElem.classList).toContain("ng-invalid");
      expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
        " Must be a valid date-time "
      );
    });
  });
});
