import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";
import {MaxValidator, MinValidator} from "../../validators";
import {NumberComponent} from "./number.component";

async function patchScheme<T extends {schema: InternalPropertySchema}>(
  fixture: ComponentFixture<T>,
  changes: Partial<(typeof fixture)["componentInstance"]["schema"]>
) {
  fixture.componentInstance.schema = {...fixture.componentInstance.schema, ...changes};
  fixture.detectChanges();
}

describe("Common#number", () => {
  let fixture: ComponentFixture<NumberComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [FormsModule, MatFormFieldModule, MatInputModule, NoopAnimationsModule],
        declarations: [NumberComponent, MinValidator, MaxValidator],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "number",
              $name: "test"
            }
          }
        ]
      })
      .compileComponents();
    fixture = TestBed.createComponent(NumberComponent);
    fixture.detectChanges();
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

    it("should write value", fakeAsync(() => {
      fixture.componentInstance.writeValue(100);
      fixture.detectChanges();
      tick();
      const inputElem = fixture.debugElement.query(By.css("input")).nativeElement;
      expect(inputElem.value).toBe("100");
    }));

    it("should emit input events", fakeAsync(() => {
      const ngModelChange = jasmine.createSpy("ngModelChange");
      fixture.componentInstance.registerOnChange(ngModelChange);
      fixture.detectChanges();
      const inputElem = fixture.debugElement.query(By.css("input")).nativeElement;
      inputElem.value = 5e1;
      inputElem.dispatchEvent(new Event("input"));
      tick();
      fixture.detectChanges();
      expect(ngModelChange).toHaveBeenCalledWith(5e1);
    }));

    describe("default", () => {
      it("should default to default value if undefined", fakeAsync(() => {
        const inputElem = fixture.debugElement.query(By.css("input")).nativeElement;
        const ngModelChange = jasmine.createSpy("ngModelChange");
        fixture.componentInstance.registerOnChange(ngModelChange);

        fixture.componentInstance.schema.default = 123;
        fixture.componentInstance.writeValue(undefined);
        fixture.detectChanges();
        tick();

        expect(ngModelChange).toHaveBeenCalledWith(123);
        expect(inputElem.value).toBe("123");
      }));
    });
  });

  describe("with validation", () => {
    describe("required", () => {
      beforeEach(() => patchScheme(fixture, {$required: true}));

      it("should not be valid at start", () => {
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");
      });

      it("should show required error in touched state", fakeAsync(() => {
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");
        expect(formFieldElem.classList).toContain("ng-untouched");

        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
        input.control.markAsTouched();
        fixture.detectChanges();
        tick();
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          "This property is required."
        );
      }));
    });

    describe("minimum", () => {
      beforeEach(() => patchScheme(fixture, {minimum: 3}));
      it("should not be valid when value is less than expected", () => {
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
        input.control.setValue(2);
        input.control.markAsTouched();
        fixture.detectChanges();
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          " This property must be greater than 3. "
        );
      });

      it("should remove errors if input greater than expected", () => {
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
        input.control.setValue(2);
        input.control.markAsTouched();
        fixture.detectChanges();
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");

        input.control.setValue(3);
        input.control.markAsTouched();
        fixture.detectChanges();
        expect(formFieldElem.classList).toContain("ng-valid");
        expect(fixture.debugElement.query(By.css("mat-error"))).toBeNull();
      });
    });

    describe("maximum", () => {
      beforeEach(() => patchScheme(fixture, {maximum: 3}));
      it("should not be valid when value is greater than expected", () => {
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
        input.control.setValue(4);
        input.control.markAsTouched();
        fixture.detectChanges();
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          " This property must be less than 3. "
        );
      });

      it("should remove errors if input less than expected", () => {
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);

        input.control.setValue(4);
        input.control.markAsTouched();
        fixture.detectChanges();
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");

        input.control.setValue(3);
        input.control.markAsTouched();
        fixture.detectChanges();
        expect(formFieldElem.classList).toContain("ng-valid");
        expect(fixture.debugElement.query(By.css("mat-error"))).toBeNull();
      });
    });
  });
});
