import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatLegacyFormFieldModule as MatFormFieldModule} from "@angular/material/legacy-form-field";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {INPUT_SCHEMA} from "../../input";
import {ColorComponent} from "./color.component";

describe("Common#color", () => {
  let fixture: ComponentFixture<ColorComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [FormsModule, MatFormFieldModule, MatInputModule, NoopAnimationsModule],
        declarations: [ColorComponent],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "color",
              $name: "test"
            }
          }
        ]
      })
      .compileComponents();
    fixture = TestBed.createComponent(ColorComponent);
    fixture.detectChanges();
  });

  describe("basic behavior", () => {
    let inputElem: HTMLInputElement;
    beforeEach(() => {
      inputElem = fixture.debugElement.query(By.css("input")).nativeElement;
    });
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
      fixture.componentInstance.writeValue("#ffffff");
      fixture.detectChanges();
      tick(10);
      expect(inputElem.value).toBe("#ffffff");
    }));

    it("should emit input events", fakeAsync(() => {
      const ngModelChange = jasmine.createSpy("ngModelChange");
      fixture.componentInstance.registerOnChange(ngModelChange);
      fixture.detectChanges();

      inputElem.value = "#000000";
      inputElem.dispatchEvent(new Event("input"));
      tick(10);
      fixture.detectChanges();
      expect(ngModelChange).toHaveBeenCalledWith("#000000");
    }));
  });
});
