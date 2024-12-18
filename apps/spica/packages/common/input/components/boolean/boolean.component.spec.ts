import {ComponentFixture, fakeAsync, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSlideToggle, MatSlideToggleModule} from "@angular/material/slide-toggle";
import {By} from "@angular/platform-browser";
import {INPUT_SCHEMA} from "../../input";
import {BooleanComponent} from "./boolean.component";

describe("Common#boolean", () => {
  beforeEach(() => {
    TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [FormsModule, MatFormFieldModule, MatSlideToggleModule],
        declarations: [BooleanComponent],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "boolean"
            }
          }
        ]
      })
      .compileComponents();
  });

  describe("basic behavior", () => {
    let fixture: ComponentFixture<BooleanComponent>;
    let labelElement: HTMLLabelElement;
    let slideToggle: MatSlideToggle;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(BooleanComponent);
      fixture.detectChanges();
      labelElement = fixture.debugElement.query(By.css("label")).nativeElement;
      slideToggle = fixture.debugElement.query(By.css("mat-slide-toggle")).componentInstance;
    }));

    it("should propagate true on click if the start value is false", () => {
      const changeSpy = jest.fn();
      fixture.componentInstance.registerOnChange(changeSpy);
      fixture.componentInstance.writeValue(false);

      labelElement.click();
      fixture.detectChanges();
      expect(changeSpy).toHaveBeenCalledWith(true);
      expect(slideToggle.checked).toBe(true);
    });

    it("should propagate false on click if the start value is true", () => {
      const changeSpy = jest.fn();
      fixture.componentInstance.registerOnChange(changeSpy);
      fixture.componentInstance.writeValue(true);

      labelElement.click();
      fixture.detectChanges();
      expect(changeSpy).toHaveBeenCalledWith(true);
      expect(slideToggle.checked).toBe(true);
    });

    describe("default", () => {
      it("should default to default value if undefined", () => {
        const ngModelChange = jest.fn();
        fixture.componentInstance.registerOnChange(ngModelChange);

        fixture.componentInstance.schema.default = false;
        fixture.componentInstance.writeValue(undefined);
        fixture.detectChanges();

        expect(ngModelChange).toHaveBeenCalledWith(false);
        expect(slideToggle.checked).toBe(false);
      });
    });
  });
});
