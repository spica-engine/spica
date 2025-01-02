import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelectModule} from "@angular/material/select";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {INPUT_SCHEMA} from "../../input";

import {MultiselectComponent} from "./multiselect.component";

describe("MultiselectComponent", () => {
  let component: MultiselectComponent;
  let fixture: ComponentFixture<MultiselectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, MatFormFieldModule, MatSelectModule, NoopAnimationsModule],
      declarations: [MultiselectComponent],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: {
            type: "multiselect",
            $name: "test",
            items: {
              type: "string",
              enum: ["some", "values"]
            }
          }
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MultiselectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should write value", fakeAsync(() => {
    fixture.componentInstance.writeValue(["myvalue"]);
    fixture.detectChanges();
    tick();
    const inputElem = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
    expect(inputElem.value).toEqual(["myvalue"]);
  }));
});
