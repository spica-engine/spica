import {ComponentFixture, fakeAsync, TestBed, tick, waitForAsync} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {By} from "@angular/platform-browser";
import {INPUT_SCHEMA} from "../../input";
import {BooleanSchemaComponent} from "./boolean-schema.component";

describe("Common#boolean-schema", () => {
  let component: BooleanSchemaComponent;
  let fixture: ComponentFixture<BooleanSchemaComponent>;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [MatSlideToggleModule, MatFormFieldModule, MatInputModule, FormsModule],
        declarations: [BooleanSchemaComponent],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "array"
            }
          }
        ]
      }).compileComponents();
      fixture = TestBed.createComponent(BooleanSchemaComponent);
      component = fixture.componentInstance;
    })
  );

  it("should be open area and vale verify", fakeAsync(() => {
    fixture.detectChanges();
    component.schema.default = true;
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const toggle = document.querySelector(".mat-slide-toggle-input");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  }));
  it("should be checked value equal to component data", fakeAsync(() => {
    fixture.detectChanges();
    const toggle = fixture.debugElement.query(By.css(".mat-slide-toggle-input"));
    toggle.nativeElement.click();
    tick();
    fixture.detectChanges();
    expect(component.schema.default).toBeTruthy();
    toggle.nativeElement.click();
    tick();
    fixture.detectChanges();
    expect(component.schema.default).toBeFalsy();
  }));
});
