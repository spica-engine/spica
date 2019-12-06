import {async, ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {
  MatCheckboxModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatSelectModule
} from "@angular/material";
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

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        MatIconModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatMenuModule,
        MatSelectModule,
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
  }));

  it("should not show inputs ", () => {
    component.origin = undefined;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css(".mat-icon"))).toBeNull();
    expect(fixture.debugElement.query(By.css(".validators"))).toBeNull();
  });

  it("should checked uniqueItem input ", fakeAsync(() => {
    component.origin = "string";
    fixture.detectChanges();
    fixture.debugElement.query(By.css("button mat-menu")).nativeElement.click();
    component.schema["uniqueItems"] = true;
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.css("mat-checkbox")).classes["mat-checkbox-checked"]
    ).toBeTruthy();
    expect(fixture.debugElement.query(By.css(".validators > div ")).childNodes.length).toEqual(3);
  }));

  it("entered values must be verified", fakeAsync(() => {
    component.origin = "string";
    fixture.detectChanges();
    fixture.debugElement.query(By.css("button mat-menu")).nativeElement.click();
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
