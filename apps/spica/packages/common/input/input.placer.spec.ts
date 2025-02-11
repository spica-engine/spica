import {ANALYZE_FOR_ENTRY_COMPONENTS, Component, DebugElement, forwardRef} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {ControlValueAccessor, FormsModule, NgModel, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {By} from "@angular/platform-browser";
import {InputSchema} from "./input";
import {InputPlacerComponent} from "./input.placer";
import {InputResolver} from "./input.resolver";

abstract class TestPlacer implements ControlValueAccessor {
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

@Component({
  template: `
    <h1>testplacer1</h1>
    <span><ng-content></ng-content></span>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TestPlacer1),
      multi: true
    }
  ]
})
class TestPlacer1 extends TestPlacer {}

@Component({
  template: ` <h1>testplacer2</h1> `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TestPlacer2),
      multi: true
    }
  ]
})
class TestPlacer2 extends TestPlacer {}

@Component({
  template: `
    <span
      [inputPlacer]="schema"
      [ngModel]="model"
      (ngModelChange)="modelChange($event)"
      name="root"
      class="my-class"
    >
      <button matSuffix></button>
    </span>
  `
})
class InputPlacerTestComponent {
  schema: InputSchema = {
    type: "test1"
  };

  model: string;
  modelChange = jasmine.createSpy("modelChange");
}

@Component({
  template: `
    <form>
      <span [inputPlacer]="schema" ngModel name="root"></span>
      <span [inputPlacer]="schema" ngModel name="root2"></span>
    </form>
  `
})
class InputPlacerTestComponent2 {
  schema: InputSchema = {
    type: "test1"
  };

  model: string;
  modelChange = jasmine.createSpy("modelChange");
}

describe("InputPlacer", () => {
  const types = {
    test1: {
      origin: "string",
      type: "test1",
      placer: TestPlacer1
    },
    test2: {
      origin: "string",
      type: "test2",
      placer: TestPlacer2
    }
  };
  let resolverSpy = {
    resolve: jasmine.createSpy("resolve").and.callFake(t => types[t])
  };

  let fixture: ComponentFixture<InputPlacerTestComponent>;
  let placer: DebugElement;
  let ngModel: NgModel;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormsModule, MatFormFieldModule],
      providers: [
        {
          provide: InputResolver,
          useValue: resolverSpy
        },
        {
          provide: ANALYZE_FOR_ENTRY_COMPONENTS,
          multi: true,
          useValue: [TestPlacer1, TestPlacer2]
        }
      ],
      declarations: [
        InputPlacerComponent,
        InputPlacerTestComponent,
        InputPlacerTestComponent2,
        TestPlacer1,
        TestPlacer2
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InputPlacerTestComponent);
    fixture.detectChanges();

    placer = fixture.debugElement.query(By.directive(TestPlacer1));
    ngModel = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
  });

  it("ensure root ngModel", () => {
    // Just to ensure we don't query child ngModels
    expect(ngModel.path).toEqual(["root"]);
  });

  describe("render", () => {
    it("should set classes", () => {
      expect(placer.nativeElement.classList).toContain("my-class");
      expect(placer.nativeElement.classList).toContain("input-placer-input");
      expect(placer.nativeElement.classList).toContain("test1");
    });

    it("should create with inital type", () => {
      expect(placer.query(By.css("h1")).nativeElement.textContent).toBe("testplacer1");
      expect(resolverSpy.resolve).toHaveBeenCalledWith("test1");
      expect(placer.componentInstance.registerOnTouched).toHaveBeenCalledTimes(1);
      expect(placer.componentInstance.registerOnChange).toHaveBeenCalledTimes(1);
    });

    it("should handle type changes", () => {
      fixture.componentInstance.schema = {type: "test2"};
      fixture.detectChanges();

      // Ensure the old input removed
      expect(fixture.debugElement.query(By.directive(TestPlacer1))).toBeNull();

      const placer = fixture.debugElement.query(By.directive(TestPlacer2));
      expect(placer.query(By.css("h1")).nativeElement.textContent).toBe("testplacer2");
      expect(resolverSpy.resolve).toHaveBeenCalledWith("test2");
      expect(placer.componentInstance.registerOnTouched).toHaveBeenCalledTimes(1);
      expect(placer.componentInstance.registerOnChange).toHaveBeenCalledTimes(1);
    });

    it("should forward matSuffix", () => {
      fixture.detectChanges();
      const span = placer.query(By.css("span"));
      expect(span.childNodes.length).toBe(1);
    });
  });

  describe("control value accessor", () => {
    it("should forward writeValue", () => {
      ngModel.control.setValue("test");
      expect(placer.componentInstance.writeValue).toHaveBeenCalledWith("test");
    });

    it("should forward setDisabledState", () => {
      ngModel.control.disable();
      expect(placer.componentInstance.setDisabledState).toHaveBeenCalledWith(true);

      ngModel.control.enable();
      expect(placer.componentInstance.setDisabledState).toHaveBeenCalledWith(false);
    });

    it("should forward changes", () => {
      placer.componentInstance._change("test1");
      expect(fixture.componentInstance.modelChange).toHaveBeenCalledWith("test1");

      placer.componentInstance._change("test2");
      expect(fixture.componentInstance.modelChange).toHaveBeenCalledWith("test2");
    });

    it("should forward touch state", () => {
      expect(ngModel.touched).toBe(false);
      placer.componentInstance._touch();
      expect(ngModel.touched).toBe(true);
    });
  });
});
