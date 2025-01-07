import {ComponentFixture, fakeAsync, TestBed, tick, waitForAsync} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {By} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {INPUT_SCHEMA} from "../..";
import {InputModule} from "../../input.module";
import {NumberSchemaComponent} from "./number-schema.component";

describe("Common#number-schema", () => {
  let component: NumberSchemaComponent;
  let fixture: ComponentFixture<NumberSchemaComponent>;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [
          MatTooltipModule,
          MatIconModule,
          MatInputModule,
          MatFormFieldModule,
          FormsModule,
          MatSlideToggleModule,
          InputModule,
          BrowserAnimationsModule
        ],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "string"
            }
          }
        ]
      }).compileComponents();
      fixture = TestBed.createComponent(NumberSchemaComponent);
      component = fixture.componentInstance;
    })
  );

  it("Should visible items", fakeAsync(() => {
    tick(1);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css("div.min-max"))).toBeTruthy();
    expect(fixture.debugElement.query(By.css("div.default"))).toBeTruthy();
    expect(fixture.debugElement.query(By.css("div.enum"))).toBeTruthy();
  }));

  it("The value entered must be the same as the variable value", fakeAsync(() => {
    component.schema.minimum = 1;
    component.schema.maximum = 3;
    component.schema.default = 2;
    component.schema.enum = [];
    tick(10);
    fixture.detectChanges();
    tick(10);
    expect(
      fixture.debugElement
        .query(By.css(".inputs > mat-form-field:first-child input"))
        .properties.value.toString()
    ).toEqual(component.schema.minimum.toString());
    expect(
      fixture.debugElement
        .query(By.css(".inputs > mat-form-field:last-child input"))
        .properties.value.toString()
    ).toEqual(component.schema.maximum.toString());
    expect(
      fixture.debugElement
        .query(By.css(".default > mat-form-field input"))
        .properties.value.toString()
    ).toBe(component.schema.default.toString());
    expect(fixture.debugElement.query(By.css("enum-schema"))).toBeTruthy();
  }));
});
