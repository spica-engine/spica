import {async, ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatSlideToggleModule
} from "@angular/material";
import {By} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {InputModule, INPUT_SCHEMA} from "../..";
import {StringSchemaComponent} from "./string-schema.component";

describe("Common#string-schema", () => {
  let component: StringSchemaComponent;
  let fixture: ComponentFixture<StringSchemaComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        MatFormFieldModule,
        MatInputModule,
        MatSlideToggleModule,
        FormsModule,
        MatIconModule,
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
    fixture = TestBed.createComponent(StringSchemaComponent);
    component = fixture.componentInstance;
  }));

  it("should be working inputs", fakeAsync(() => {
    component.schema.default = "test";
    tick(10);
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();
    const defaultInput = fixture.debugElement.queryAll(By.css("input"))[0];

    tick(10);
    fixture.detectChanges();
    expect(defaultInput.nativeElement.value).toEqual(component.schema.default);

    tick(10);
    fixture.detectChanges();

    defaultInput.nativeElement.value = defaultInput.nativeElement.value + "-test";

    defaultInput.nativeElement.dispatchEvent(new Event("input"));

    tick(10);
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();

    expect(defaultInput.nativeElement.value).toEqual(component.schema.default);
  }));
});
