import {ComponentFixture, TestBed} from "@angular/core/testing";
import {INPUT_SCHEMA} from "../..";
import {InputModule} from "@spica-client/common";

import {MultiselectSchemaComponent} from "./multiselect-schema.component";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";

describe("MultiselectSchemaComponent", () => {
  let component: MultiselectSchemaComponent;
  let fixture: ComponentFixture<MultiselectSchemaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputModule, NoopAnimationsModule],
      declarations: [MultiselectSchemaComponent],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: {
            type: "multiselect"
          }
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MultiselectSchemaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component.availableTypes).toEqual(["string", "number"]);
    expect(component.schema.items).toEqual({type: "string"});
  });

  it("should reset items on change", () => {
    component.schema.items = {type: "string", enum: ["some", "values"]};
    component.onTypeChange("number");

    expect(component.schema).toEqual({type: "multiselect", items: {type: "number"}});
  });
});
