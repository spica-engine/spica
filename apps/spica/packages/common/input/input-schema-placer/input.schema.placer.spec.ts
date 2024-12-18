import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatOptionModule} from "@angular/material/core";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {MatSelectModule} from "@angular/material/select";
import {By} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {InputResolver} from "..";
import {InputSchemaPlacer} from "./input.schema.placer";
import {Injector} from "@angular/core";

describe("Common#schema-placer", () => {
  let component: InputSchemaPlacer;
  let fixture: ComponentFixture<InputSchemaPlacer>;
  let injector: Injector;
  const inputResolver = {
    coerce: jest.fn(() => undefined),
    resolve: jest.fn(() => ({})),
    entries: jest.fn(() => [])
  };
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        MatSelectModule,
        MatInputModule,
        FormsModule,
        MatOptionModule,
        FormsModule,
        MatFormFieldModule,
        BrowserAnimationsModule
      ],
      declarations: [InputSchemaPlacer],
      providers: [
        {
          provide: InputResolver,
          useValue: inputResolver
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(InputSchemaPlacer);
    component = fixture.componentInstance;
  });

  it("Should be working inputs", fakeAsync(() => {
    fixture.detectChanges();
    const titleInput = fixture.debugElement.query(By.css("input"));
    const descriptionTextarea = fixture.debugElement.query(By.css("textarea"));
    component.schema = {
      type: "string",
      title: "test",
      description: "test"
    };
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();
    tick(10);

    expect(component.schema.title).toEqual(titleInput.nativeElement.value);
    expect(component.schema.description).toEqual(descriptionTextarea.nativeElement.value);

    tick(10);
    fixture.detectChanges();

    titleInput.nativeElement.value = titleInput.nativeElement.value + "-test";
    descriptionTextarea.nativeElement.value = descriptionTextarea.nativeElement.value + "-test";

    titleInput.nativeElement.dispatchEvent(new Event("input"));

    descriptionTextarea.nativeElement.dispatchEvent(new Event("input"));

    tick(10);
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();

    expect(titleInput.nativeElement.value).toEqual(component.schema.title);
    expect(descriptionTextarea.nativeElement.value).toEqual(component.schema.description);
  }));

  it("Should not show the basic settings default", fakeAsync(() => {
    fixture.componentInstance.advancedOnly = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("input"))).toBeFalsy();
    expect(fixture.debugElement.query(By.css("textarea"))).toBeFalsy();
  }));
});
