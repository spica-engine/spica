import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";
import {MatSelectModule} from "@angular/material/select";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";
import {StringComponent} from "./string.component";

async function patchScheme<T extends {schema: InternalPropertySchema}>(
  fixture: ComponentFixture<T>,
  changes: Partial<typeof fixture["componentInstance"]["schema"]>
) {
  fixture.componentInstance.schema = {...fixture.componentInstance.schema, ...changes};
  fixture.detectChanges(false);
}

describe("Common#string", () => {
  let fixture: ComponentFixture<StringComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [
          FormsModule,
          MatFormFieldModule,
          MatInputModule,
          MatMenuModule,
          MatSelectModule,
          MatIconModule,
          NoopAnimationsModule
        ],
        declarations: [StringComponent],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "string",
              $name: "test"
            }
          }
        ]
      })
      .compileComponents();
    fixture = TestBed.createComponent(StringComponent);
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
      fixture.detectChanges(false);
      expect(fixture.debugElement.query(By.css("mat-hint")).nativeElement.textContent).toBe(
        description
      );
    });

    it("should show select if schema has enums", () => {
      patchScheme(fixture, {enum: ["123", "test"]});
      expect(fixture.debugElement.query(By.css("mat-select"))).toBeTruthy();
    });

    it("should be valid pristine and untouched", () => {
      const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
      expect(formFieldElem.classList).toContain("ng-untouched");
      expect(formFieldElem.classList).toContain("ng-pristine");
      expect(formFieldElem.classList).toContain("ng-valid");
    });

    it("should write value", fakeAsync(() => {
      fixture.componentInstance.writeValue("myvalue");
      fixture.detectChanges();
      tick();
      const inputElem = fixture.debugElement.query(By.css("input")).nativeElement;
      expect(inputElem.value).toBe("myvalue");
    }));

    it("should emit input events", fakeAsync(() => {
      const ngModelChange = jasmine.createSpy("ngModelChange");
      fixture.componentInstance.registerOnChange(ngModelChange);
      fixture.detectChanges();
      const inputElem = fixture.debugElement.query(By.css("input")).nativeElement;
      inputElem.value = "myvalue";
      inputElem.dispatchEvent(new Event("input"));
      tick();
      fixture.detectChanges();
      expect(ngModelChange).toHaveBeenCalledWith("myvalue");
    }));

    describe("default", () => {
      it("should default to default value if undefined", fakeAsync(() => {
        const ngModelChange = jasmine.createSpy("ngModelChange");
        fixture.componentInstance.registerOnChange(ngModelChange);

        fixture.componentInstance.schema.default = "test";
        fixture.componentInstance.writeValue(undefined);
        fixture.detectChanges();
        tick();

        const inputElem = fixture.debugElement.query(By.css("input")).nativeElement;
        expect(ngModelChange).toHaveBeenCalledWith("test");
        expect(inputElem.value).toBe("test");
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
        fixture.detectChanges(false);
        tick();
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          "This property is required."
        );
      }));
    });

    describe("minLength", () => {
      beforeEach(() => patchScheme(fixture, {minLength: 3}));
      it("should not be valid when value is less than expected", () => {
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);

        input.control.setValue("te");
        input.control.markAsTouched();
        fixture.detectChanges(false);
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          " This property must be greater than 2 characters. "
        );
      });

      it("should remove errors if input greater than expected", () => {
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);

        input.control.setValue("te");
        input.control.markAsTouched();
        fixture.detectChanges(false);
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");

        input.control.setValue("tet");
        input.control.markAsTouched();
        fixture.detectChanges(false);
        expect(formFieldElem.classList).toContain("ng-valid");
        expect(fixture.debugElement.query(By.css("mat-error"))).toBe(null);
      });
    });

    describe("maxLength", () => {
      beforeEach(() => patchScheme(fixture, {maxLength: 3}));
      it("should not be valid when value is greater than expected", () => {
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);

        input.control.setValue("test");
        input.control.markAsTouched();
        fixture.detectChanges(false);
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          " This property must be less than 3 characters. "
        );
      });

      it("should remove errors if input less than expected", () => {
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);

        input.control.setValue("test");
        input.control.markAsTouched();
        fixture.detectChanges(false);
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");

        input.control.setValue("tet");
        input.control.markAsTouched();
        fixture.detectChanges(false);
        expect(formFieldElem.classList).toContain("ng-valid");
        expect(fixture.debugElement.query(By.css("mat-error"))).toBe(null);
      });
    });

    describe("pattern", () => {
      it("should not be valid when value is does not match the pattern", () => {
        patchScheme(fixture, {
          pattern: "^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:.[a-zA-Z0-9-]+)*$"
        });
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
        input.control.setValue("test[at]example.io");
        input.control.markAsTouched();
        fixture.detectChanges(false);
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          " This property must match the pattern. "
        );
      });

      it("should remove errors if input matches the pattern", () => {
        patchScheme(fixture, {
          pattern: "^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:.[a-zA-Z0-9-]+)*$"
        });
        const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);

        input.control.setValue("test[at]example.io");
        input.control.markAsTouched();
        fixture.detectChanges(false);
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");

        input.control.setValue("test@example.io");
        input.control.markAsTouched();
        fixture.detectChanges(false);
        expect(formFieldElem.classList).toContain("ng-valid");
        expect(fixture.debugElement.query(By.css("mat-error"))).toBe(null);
      });
    });
  });
});
