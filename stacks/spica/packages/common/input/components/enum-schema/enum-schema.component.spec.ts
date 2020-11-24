import { ComponentFixture, fakeAsync, TestBed, tick, waitForAsync } from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatIconModule} from "@angular/material/icon";
import {By} from "@angular/platform-browser";
import {InputModule} from "@spica-client/common";
import {INPUT_SCHEMA} from "../..";
import {EnumSchemaComponent} from "./enum-schema.component";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";

describe("Common#enum-schema", () => {
  let component: EnumSchemaComponent;
  let fixture: ComponentFixture<EnumSchemaComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [MatIconModule, FormsModule, InputModule, NoopAnimationsModule],
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

  it("add button should be working", () => {
    const mockChipListEvent = {input: {value: "test"}, value: "test"};
    component.addItem(mockChipListEvent as any);
    expect(component.schema.enum).toEqual(["test"]);
    expect(mockChipListEvent.input.value).toEqual("");
  });
});
