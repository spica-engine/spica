import {ANALYZE_FOR_ENTRY_COMPONENTS, Component, forwardRef} from "@angular/core";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {ControlValueAccessor, FormsModule, NgModel, NG_VALUE_ACCESSOR} from "@angular/forms";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {INPUT_SCHEMA} from "../../input";
import {InputPlacerComponent} from "../../input.placer";
import {InputResolver} from "../../input.resolver";
import {ObjectComponent} from "./object.component";

@Component({
  template: ` <h1>testplacer1</h1> `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StringPlacer),
      multi: true
    }
  ]
})
class StringPlacer implements ControlValueAccessor {
  writeValue = jasmine.createSpy("writeValue");
  setDisabledState = jasmine.createSpy("setDisabledState");

  _change: Function;
  registerOnChange = jasmine
    .createSpy("registerOnChange", fn => {
      this._change = fn;
    })
    .and.callThrough();

  _touch: Function;
  registerOnTouched = jasmine
    .createSpy("registerOnChange", fn => {
      this._touch = fn;
    })
    .and.callThrough();
}

describe("Common#object", () => {
  let fixture: ComponentFixture<ObjectComponent>;
  let changeSpy: jasmine.Spy;
  const inputResolver = {
    resolve: jasmine.createSpy("resolve").and.returnValue({
      origin: "string",
      type: "string",
      placer: StringPlacer
    })
  };

  beforeEach(() => {
    TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [FormsModule, NoopAnimationsModule],
        declarations: [StringPlacer, ObjectComponent, InputPlacerComponent],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "object",
              $name: "test",
              required: ["prop1"],
              properties: {
                prop1: {
                  type: "string"
                },
                prop2: {
                  type: "string"
                }
              }
            }
          },
          {
            provide: InputResolver,
            useValue: inputResolver
          },
          {
            provide: ANALYZE_FOR_ENTRY_COMPONENTS,
            multi: true,
            useValue: StringPlacer
          }
        ]
      })
      .compileComponents();
    fixture = TestBed.createComponent(ObjectComponent);
    fixture.detectChanges(false);
    changeSpy = jasmine.createSpy("ngModelChange");
    fixture.componentInstance.registerOnChange(changeSpy);
  });

  describe("basic behavior", () => {
    it("should show title", () => {
      const title = (fixture.componentInstance.schema.title = "my title");
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("h4")).nativeElement.textContent).toBe(title);
    });

    it("should show description if provided", () => {
      expect(fixture.debugElement.query(By.css("small"))).toBeNull();
      const description = (fixture.componentInstance.schema.description = "my long description");
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("small")).nativeElement.textContent).toBe(
        description
      );
    });
  });

  describe("properties", () => {
    it("should disable properties when disabled", fakeAsync(() => {
      fixture.componentInstance.setDisabledState(true);
      fixture.detectChanges();
      tick();
      const ngModels = fixture.debugElement
        .queryAll(By.directive(NgModel))
        .map(m => m.injector.get(NgModel));
      expect(ngModels.map(m => m.disabled)).toEqual([true, true]);
    }));

    it("should render properties", () => {
      const properties = fixture.debugElement.queryAll(By.css("section:last-of-type > span"));
      expect(properties.length).toBe(2);
      expect(properties.map(m => m.injector.get(NgModel)).map(m => m.name)).toEqual([
        "testprop1",
        "testprop2"
      ]);
    });

    it("should write value", fakeAsync(() => {
      fixture.componentInstance.writeValue({prop1: "test"});
      fixture.detectChanges();
      tick();
      const placer = fixture.debugElement.query(By.directive(StringPlacer));
      expect(placer.componentInstance.writeValue).toHaveBeenCalledWith("test");
    }));

    it("should propagate changes from placer", () => {
      fixture.componentInstance.writeValue(undefined);
      const placers = fixture.debugElement.queryAll(By.directive(StringPlacer));
      placers[0].componentInstance._change("test1");
      placers[1].componentInstance._change("test2");
      expect(fixture.componentInstance.value).toEqual({prop1: "test1", prop2: "test2"});
    });
  });

  describe("validation", () => {
    it("should be invalid when a property is required", () => {
      const ngModel = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
      expect(ngModel.invalid).toBe(true);
    });
  });
});
