import {ComponentFixture, fakeAsync, TestBed, tick, waitForAsync} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatOptionModule} from "@angular/material/core";
import {MatDialogModule} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatSelectModule} from "@angular/material/select";
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

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [
          MatMenuModule,
          MatIconModule,
          MatCheckboxModule,
          MatInputModule,
          MatDialogModule,
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
    })
  );

  xit("Should be visible items", fakeAsync(() => {
    fixture.detectChanges();
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
    const firstItem = fixture.debugElement.query(By.css(".property:first-of-type"));

    expect(firstItem).toBeTruthy();
  }));

  it("Should be working remove button", fakeAsync(async () => {
    component.schema.properties = {test: true};
    fixture.detectChanges();
    const removeButton = fixture.debugElement.query(By.css(".meta-info button:last-of-type"));
    fixture.detectChanges();
    tick(10);
    removeButton.nativeElement.click();
    tick(10);
    fixture.detectChanges();
    tick(10);
    expect(component.schema.properties.test).toBeUndefined();
  }));

  it("should remove field from required fields when its removed from schema", () => {
    fixture.componentInstance.schema = {
      type: "some_type",
      properties: {
        removed_field: {},
        unRemoved_field: {}
      },
      required: ["removed_field", "unRemoved_field"]
    };
    fixture.detectChanges();

    fixture.componentInstance.removeProperty("removed_field");
    expect(fixture.componentInstance.schema).toEqual({
      type: "some_type",
      properties: {
        unRemoved_field: {}
      },
      required: ["unRemoved_field"]
    });
  });
});
