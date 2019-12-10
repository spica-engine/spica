import {async, ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {
  MatCheckboxModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatOptionModule,
  MatSelectModule
} from "@angular/material";
import {By} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {InputResolver, INPUT_SCHEMA} from "../..";
import {InputSchemaPlacer} from "../../input-schema-placer/input.schema.placer";
import {ObjectSchemaComponent} from "./object-schema.component";

describe("Common#object-schema", () => {
  let component: ObjectSchemaComponent;
  let fixture: ComponentFixture<ObjectSchemaComponent>;
  const inputResolver = {
    resolve: jasmine.createSpy("resolve").and.returnValue({}),
    entries: jasmine.createSpy("entries").and.returnValue([])
  };

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        MatMenuModule,
        MatIconModule,
        MatCheckboxModule,
        MatInputModule,
        FormsModule,
        MatOptionModule,
        MatSelectModule,
        BrowserAnimationsModule
      ],
      declarations: [ObjectSchemaComponent, InputSchemaPlacer],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: {
            type: "string"
          }
        },
        {
          provide: InputResolver,
          useValue: inputResolver
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ObjectSchemaComponent);
    component = fixture.componentInstance;
  }));

  it("Should be visible items", fakeAsync(() => {
    expect(fixture.debugElement.query(By.css("button:last-child"))).toBeTruthy();
    expect(fixture.debugElement.query(By.css(" mat-form-field "))).toBeTruthy();
    expect(fixture.debugElement.query(By.css("button > .validators "))).toBeTruthy();
  }));

  it("should be working inputs", fakeAsync(async () => {
    component.schema.properties.test = {
      type: "string",
      title: "test",
      description: "Description of test"
    };
    tick(10);
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();
    const titleInput = fixture.debugElement.queryAll(By.css("input"))[0];
    const descriptionTextarea = fixture.debugElement.queryAll(By.css("textarea"))[0];
    tick(10);
    fixture.detectChanges();
    expect(descriptionTextarea.nativeElement.value).toEqual(
      component.schema.properties.test.description
    );
    expect(titleInput.nativeElement.value).toEqual(component.schema.properties.test.title);

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

    expect(titleInput.nativeElement.value).toEqual(component.schema.properties.test.title);
    expect(descriptionTextarea.nativeElement.value).toEqual(
      component.schema.properties.test.description
    );
  }));

  it("Should be working add and remove button", fakeAsync(async () => {
    const fieldName = fixture.debugElement.queryAll(By.css("input"))[0];
    const addButton = fixture.debugElement.queryAll(By.css("button"))[1];
    fixture.detectChanges();
    tick(10);
    fieldName.nativeElement.value = "Test";
    fixture.detectChanges();
    tick(10);
    fieldName.nativeElement.dispatchEvent(new Event("input"));

    fixture.detectChanges();
    tick(10);
    addButton.nativeElement.click();

    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();
    tick(10);
    const titleInput = fixture.debugElement.queryAll(By.css("input"))[0];
    const descriptionTextarea = fixture.debugElement.queryAll(By.css("textarea"))[0];

    expect(component.schema.properties.test["title"]).toEqual(titleInput.nativeElement.value);
    expect(component.schema.properties.test["description"]).toEqual(
      descriptionTextarea.nativeElement.value
    );
    const removeButton = fixture.debugElement.queryAll(By.css("button"))[1];
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();
    tick(10);
    removeButton.nativeElement.click();
    tick(10);
    fixture.detectChanges();
    tick(10);
    expect(component.schema.properties.test).toBeUndefined();
  }));
});
