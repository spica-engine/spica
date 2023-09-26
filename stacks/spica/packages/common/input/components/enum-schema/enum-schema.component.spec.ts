import {ComponentFixture, fakeAsync, TestBed, tick, waitForAsync} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatIconModule} from "@angular/material/icon";
import {InputModule} from "@spica-client/common";
import {INPUT_SCHEMA} from "../..";
import {EnumSchemaComponent} from "./enum-schema.component";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";

describe("Common#enum-schema", () => {
  let component: EnumSchemaComponent;
  let fixture: ComponentFixture<EnumSchemaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatIconModule, FormsModule, InputModule, NoopAnimationsModule],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: {
            type: "string"
          }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(EnumSchemaComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("add button should be working", () => {
    const mockChipListEvent = {input: {value: "test"}, value: "test"};
    component.addItem(mockChipListEvent as any);
    expect(component.schema.enum).toEqual(["test"]);
    expect(mockChipListEvent.input.value).toEqual("");
  });

  it("should cast input value to number", () => {
    component.schema.type = "number";
    const mockChipListEvent = {input: {value: "0"}, value: "0"};
    component.addItem(mockChipListEvent as any);
    expect(component.schema.enum).toEqual([0]);
    expect(mockChipListEvent.input.value).toEqual("");
  });

  it("should not cast input value to number", () => {
    component.schema.type = "string";
    const mockChipListEvent = {input: {value: "0"}, value: "0"};
    component.addItem(mockChipListEvent as any);
    expect(component.schema.enum).toEqual(["0"]);
    expect(mockChipListEvent.input.value).toEqual("");
  });

  it("should not add value and show the error for numbers", () => {
    component.schema.type = "number";
    const mockChipListEvent = {input: {value: "test"}, value: "test"};
    component.addItem(mockChipListEvent as any);
    expect(component.schema.enum).toEqual(undefined);
    expect(mockChipListEvent.input.value).toEqual("test");

    fixture.detectChanges();

    const error = fixture.debugElement.nativeElement.querySelector("mat-mdc-error");

    expect(error.textContent).toEqual("Enum value must be a valid number");
  });

  it("should not add value and show the error for string", () => {
    component.schema.type = "string";
    const mockChipListEvent = {input: {value: ""}, value: ""};
    component.addItem(mockChipListEvent as any);
    expect(component.schema.enum).toEqual(undefined);
    expect(mockChipListEvent.input.value).toEqual("");

    fixture.detectChanges();

    const error = fixture.debugElement.nativeElement.querySelector("mat-mdc-error");

    expect(error.textContent).toEqual("Enum value must be a valid string");
  });
});
