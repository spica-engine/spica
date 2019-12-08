import {async, ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatIconModule} from "@angular/material";
import {By} from "@angular/platform-browser";
import {InputModule} from "@spica-client/common";
import {INPUT_SCHEMA} from "../..";
import {EnumSchemaComponent} from "./enum-schema.component";

describe("Common#enum-schema", () => {
  let component: EnumSchemaComponent;
  let fixture: ComponentFixture<EnumSchemaComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [MatIconModule, FormsModule, InputModule],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: {
            type: "boolean"
          }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(EnumSchemaComponent);
    component = fixture.componentInstance;
  }));

  it("add button should be working", fakeAsync(() => {
    const button = fixture.debugElement.query(By.css("span > button"));
    button.nativeElement.click();
    fixture.detectChanges();
    tick(100);
    fixture.detectChanges();
    expect(component.schema.type).toEqual("boolean");
    expect(fixture.debugElement.query(By.css(".enum-item"))).toBeTruthy();
  }));
});
