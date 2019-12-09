import {CdkDragDrop, DragDropModule} from "@angular/cdk/drag-drop";
import {ANALYZE_FOR_ENTRY_COMPONENTS, Component, forwardRef} from "@angular/core";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {ControlValueAccessor, FormsModule, NgModel, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule} from "@angular/material";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {INPUT_SCHEMA} from "../../input";
import {InputPlacerComponent} from "../../input.placer";
import {InputResolver} from "../../input.resolver";
import {MaxItemsValidator, MinItemsValidator, UniqueItemsValidator} from "../../validators";
import {ArrayComponent} from "./array.component";

function createEvent<T>(previousIndex: number, currentIndex: number): CdkDragDrop<T[], T[]> {
  return {
    previousIndex: previousIndex,
    currentIndex: currentIndex,
    item: undefined,
    container: undefined,
    previousContainer: undefined,
    isPointerOverContainer: true,
    distance: {x: 0, y: 0}
  };
}

@Component({
  template: `
    <h1>testplacer1</h1>
  `,
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

describe("Common#array", () => {
  let fixture: ComponentFixture<ArrayComponent>;
  let changeSpy: jasmine.Spy;
  const inputResolver = {
    coerce: jasmine.createSpy("coerce").and.returnValue(undefined),
    resolve: jasmine.createSpy("resolve").and.returnValue({
      origin: "string",
      type: "string",
      placer: StringPlacer
    })
  };

  beforeEach(() => {
    TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [
          FormsModule,
          MatCardModule,
          MatButtonModule,
          MatFormFieldModule,
          MatIconModule,
          DragDropModule,
          NoopAnimationsModule
        ],
        declarations: [
          StringPlacer,
          ArrayComponent,
          InputPlacerComponent,
          UniqueItemsValidator,
          MinItemsValidator,
          MaxItemsValidator
        ],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "array",
              $name: "test",
              items: {
                type: "string"
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
    fixture = TestBed.createComponent(ArrayComponent);
    fixture.detectChanges();
    changeSpy = jasmine.createSpy("ngModelChange");
    fixture.componentInstance.registerOnChange(changeSpy);
  });

  describe("basic behavior", () => {
    it("should show name as title if title is undefined", () => {
      fixture.componentInstance.schema.title = undefined;
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-card-title")).nativeElement.textContent).toBe(
        "test"
      );
    });

    it("should show title", () => {
      const title = (fixture.componentInstance.schema.title = "my title");
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-card-title")).nativeElement.textContent).toBe(
        title
      );
    });

    it("should show description if provided", () => {
      expect(fixture.debugElement.query(By.css("mat-card-subtitle"))).toBeNull();
      const description = (fixture.componentInstance.schema.description = "my long description");
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("mat-card-subtitle")).nativeElement.textContent
      ).toBe(description);
    });

    it("should disable placer & add & remove button when disabled", fakeAsync(() => {
      fixture.componentInstance.writeValue(["test"]);
      fixture.componentInstance.setDisabledState(true);
      fixture.detectChanges();
      tick();
      const addButton = fixture.debugElement.query(
        By.css("div:first-of-type > button:last-of-type")
      );
      const placer = fixture.debugElement.query(By.directive(StringPlacer));
      const removeButton = fixture.debugElement.query(By.css("div:last-of-type > button"));

      expect(addButton.nativeElement.disabled).toBe(true);
      expect(removeButton.nativeElement.disabled).toBe(true);
      expect(placer.componentInstance.setDisabledState).toHaveBeenCalledTimes(1);
      expect(placer.componentInstance.setDisabledState).toHaveBeenCalledWith(true);
    }));
  });

  describe("items", () => {
    it("should render item buttons and make first one active", () => {
      fixture.componentInstance.writeValue(["test", "test2"]);
      fixture.detectChanges();
      const buttons = fixture.debugElement.queryAll(
        By.css("div:first-of-type > button:not(:last-of-type)")
      );
      expect(buttons.map(b => b.nativeElement.textContent)).toEqual([" 1 ", " 2 "]);
      expect(buttons[0].nativeElement.classList).toContain("mat-primary");

      expect(fixture.componentInstance._activeIndex).toBe(0);
      expect(fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel).name).toEqual(
        "test0"
      );
    });

    it("should change active item", fakeAsync(() => {
      fixture.componentInstance.writeValue(["test", "test2"]);
      fixture.detectChanges();

      const placer = fixture.debugElement.query(By.directive(StringPlacer));
      const lastItemButton = fixture.debugElement.query(
        By.css("div:first-of-type > button:nth-child(2)")
      );
      lastItemButton.nativeElement.click();
      fixture.detectChanges();
      tick();

      expect(lastItemButton.nativeElement.classList).toContain("mat-primary");
      expect(placer.componentInstance.writeValue).toHaveBeenCalledTimes(3);
      expect(placer.componentInstance.writeValue).toHaveBeenCalledWith("test2");

      expect(fixture.componentInstance._activeIndex).toBe(1);
      expect(fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel).name).toEqual(
        "test1"
      );
    }));

    it("should push an item if array is empty", fakeAsync(() => {
      fixture.componentInstance.writeValue(undefined);
      fixture.detectChanges();
      expect(changeSpy).not.toHaveBeenCalled();
      expect(fixture.componentInstance._values).toEqual([undefined]);
      expect(inputResolver.coerce).toHaveBeenCalledWith("string");
    }));

    it("should write value to placer", fakeAsync(() => {
      fixture.componentInstance.writeValue(["test"]);
      fixture.detectChanges();
      tick();
      const placer = fixture.debugElement.query(By.directive(StringPlacer));
      expect(placer.componentInstance.writeValue).toHaveBeenCalledTimes(2);
      expect(placer.componentInstance.writeValue).toHaveBeenCalledWith("test");
    }));

    it("should propagate changes from placer", fakeAsync(() => {
      fixture.componentInstance.writeValue(["test"]);
      fixture.detectChanges();
      tick();

      const placer = fixture.debugElement.query(By.directive(StringPlacer));
      placer.componentInstance._change("test123");
      tick();

      expect(changeSpy).toHaveBeenCalledTimes(1);
      expect(changeSpy).toHaveBeenCalledWith(["test123"]);
    }));

    it("should be able to move items", fakeAsync(() => {
      fixture.componentInstance.writeValue(["test1", "test2"]);
      fixture.detectChanges();
      tick();

      const placer = fixture.debugElement.query(By.directive(StringPlacer));
      placer.componentInstance.writeValue.calls.reset();

      fixture.componentInstance.move(createEvent(0, 1));
      fixture.detectChanges();
      tick();
      expect(fixture.componentInstance._values).toEqual(["test2", "test1"]);
      expect(fixture.componentInstance._activeIndex).toBe(0);
      expect(placer.componentInstance.writeValue).toHaveBeenCalledTimes(1);
      expect(placer.componentInstance.writeValue).toHaveBeenCalledWith("test2");
    }));

    it("should add item and make it active", () => {
      const button = fixture.debugElement.query(By.css("div > button:last-of-type"));
      button.nativeElement.click();
      fixture.detectChanges();
      const itemButton = fixture.debugElement.query(
        By.css("div:first-of-type > button:first-of-type")
      );
      expect(itemButton.nativeElement.classList).toContain("mat-primary");
      expect(fixture.componentInstance._values).toEqual([undefined]);
      expect(inputResolver.coerce).toHaveBeenCalledWith("string");
    });

    it("should remove item", () => {
      fixture.componentInstance.writeValue(["test"]);
      fixture.detectChanges();
      const button = fixture.debugElement.query(By.css("div:last-of-type > button"));
      button.nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance._values).toEqual([]);
    });
  });

  describe("validation", () => {
    describe("uniqueItems", () => {
      it("should not show errors", () => {
        fixture.componentInstance.schema.uniqueItems = true;
        fixture.componentInstance.writeValue(["test", "test1"]);
        fixture.detectChanges(false);
        expect(fixture.debugElement.query(By.css("mat-error"))).toBeNull();
      });

      it("should show errors", fakeAsync(() => {
        fixture.componentInstance.schema.uniqueItems = true;
        fixture.componentInstance.writeValue(["test", "test"]);
        fixture.detectChanges(false);
        tick();
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          " All items in the array must be unique. "
        );
      }));
    });

    describe("minItems", () => {
      it("should not show errors", () => {
        fixture.componentInstance.schema.minItems = 2;
        fixture.componentInstance.writeValue(["test", "test1"]);
        fixture.detectChanges(false);
        expect(fixture.debugElement.query(By.css("mat-error"))).toBeNull();
      });

      it("should show errors", fakeAsync(() => {
        fixture.componentInstance.schema.minItems = 2;
        fixture.componentInstance.writeValue(["test"]);
        fixture.detectChanges(false);
        tick();
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          " Array must have at least 2 items. "
        );
      }));
    });

    describe("maxItems", () => {
      it("should not show errors", () => {
        fixture.componentInstance.schema.maxItems = 2;
        fixture.componentInstance.writeValue(["test", "test"]);
        fixture.detectChanges(false);
        expect(fixture.debugElement.query(By.css("mat-error"))).toBeNull();
      });

      it("should show errors", fakeAsync(() => {
        fixture.componentInstance.schema.maxItems = 2;
        fixture.componentInstance.writeValue(["test", "test", "test"]);
        fixture.detectChanges(false);
        tick();
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
          " Array can have maximum 2 items. "
        );
      }));
    });
  });
});
