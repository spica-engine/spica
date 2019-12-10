import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {
  MatFormFieldModule,
  MatInputModule,
  MatOptionModule,
  MatSelectModule
} from "@angular/material";
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
    coerce: jasmine.createSpy("coerce").and.returnValue(undefined),
    resolve: jasmine.createSpy("resolve").and.returnValue({}),
    entries: jasmine.createSpy("entries").and.returnValue([])
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
    const titleInput = fixture.debugElement.queryAll(By.css("input"))[0];
    const descriptionTextarea = fixture.debugElement.queryAll(By.css("textarea"))[0];
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
});
