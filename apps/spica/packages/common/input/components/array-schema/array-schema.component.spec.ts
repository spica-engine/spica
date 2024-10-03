import {ComponentFixture, fakeAsync, TestBed, tick, waitForAsync} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggle, MatSlideToggleModule} from "@angular/material/slide-toggle";
import {By} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {InputResolver} from "../..";
import {INPUT_SCHEMA} from "../../input";
import {InputSchemaPlacer} from "../../input-schema-placer/input.schema.placer";
import {ArraySchemaComponent} from "./array-schema.component";

describe("Common#array-schema", () => {
  let component: ArraySchemaComponent;
  let fixture: ComponentFixture<ArraySchemaComponent>;
  const inputResolver = {
    coerce: jasmine.createSpy("coerce").and.returnValue(undefined),
    resolve: jasmine.createSpy("resolve").and.returnValue({}),
    getOriginByType: jasmine.createSpy("getOriginByType").and.returnValue({}),
    entries: jasmine.createSpy("entries").and.returnValue([])
  };

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [
          FormsModule,
          MatIconModule,
          MatCheckboxModule,
          MatSelectModule,
          MatFormFieldModule,
          MatMenuModule,
          MatSlideToggleModule,
          MatInputModule,
          BrowserAnimationsModule
        ],
        declarations: [ArraySchemaComponent, InputSchemaPlacer],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "array"
            }
          },
          {
            provide: InputResolver,
            useValue: inputResolver
          }
        ]
      }).compileComponents();
      fixture = TestBed.createComponent(ArraySchemaComponent);
      component = fixture.componentInstance;
    })
  );

  it("should not show inputs ", () => {
    component.origin = undefined;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css(".mat-icon"))).toBeNull();
    expect(fixture.debugElement.query(By.css(".validators"))).toBeNull();
  });

  it("should checked uniqueItem input ", fakeAsync(() => {
    component.origin = "string";
    fixture.detectChanges();
    component.schema["uniqueItems"] = true;
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.css("mat-slide-toggle")).classes["mat-checked"]
    ).toBeTruthy();
  }));

  xit("entered values must be verified", fakeAsync(() => {
    component.origin = "string";
    fixture.detectChanges();
    tick(10);
    document.querySelectorAll("input").forEach(element => {
      let elem = element.getAttribute("placeholder");
      if (elem == "Minimum items") {
        element.value = "1";
        element.dispatchEvent(new Event("input"));
      }
      if (elem == "Maximum items") {
        element.value = "2";
        element.dispatchEvent(new Event("input"));
      }
    });

    fixture.detectChanges();
    tick(10);
    expect(component.schema.maxItems).toEqual(2);
    expect(component.schema.minItems).toEqual(1);
  }));
});
