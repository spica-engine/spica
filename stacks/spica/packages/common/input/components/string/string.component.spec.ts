import {ComponentFixture, fakeAsync, TestBed, tick, flushMicrotasks} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatSelectModule
} from "@angular/material";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";
import {StringComponent} from "./string.component";

async function changeScheme<T extends {schema: InternalPropertySchema}>(
  fixture: ComponentFixture<T>,
  changes: Partial<typeof fixture["componentInstance"]["schema"]>
) {
  fixture.componentInstance.schema = {...fixture.componentInstance.schema, ...changes};
  fixture.detectChanges(false);
}

fdescribe("Common#string", () => {
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

  it("should create and set the model name", () => {
    const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
    expect(input.path).toEqual(["test"]);
  });

  it("should show description", () => {
    const description = (fixture.componentInstance.schema.description = "my long description");
    fixture.detectChanges(false);
    expect(fixture.debugElement.query(By.css("mat-hint")).nativeElement.textContent).toBe(
      description
    );
  });

  it("should default to default value if undefined", fakeAsync(() => {
    const inputElem = fixture.debugElement.query(By.css("input")).nativeElement;
    const changeSpy = jasmine.createSpy("ngModelChange");
    fixture.componentInstance.registerOnChange(changeSpy);

    fixture.componentInstance.schema.default = "test";
    fixture.componentInstance.writeValue(undefined);
    fixture.detectChanges();
    tick();
    expect(changeSpy).toHaveBeenCalledWith("test");
    expect(inputElem.value).toBe("test");
  }));

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

  describe("with validation", () => {
    describe("required", () => {
      beforeEach(() => changeScheme(fixture, {$required: true}));
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
      it("should not be valid when value is less than expected", fakeAsync(() => {
        changeScheme(fixture, {minLength: 3});
        fixture.componentInstance.writeValue('tt');
        tick();
        fixture.detectChanges();
        const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
        expect(formFieldElem.classList).toContain("ng-invalid");
      }));
    });
  });
});
