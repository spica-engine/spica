import {CommonModule} from "@angular/common";
import {Component, forwardRef, SimpleChange} from "@angular/core";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {MatLegacySelectModule as MatSelectModule} from "@angular/material/legacy-select";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {InputModule} from "@spica-client/common";
import {OwlDateTimeModule, OwlDateTimeInputDirective} from "@danielmoncada/angular-datetime-picker";
import {FilterComponent} from "./filter.component";
import {EditorModule} from "@spica-client/common/code-editor";
import {MatLegacyChipsModule as MatChipsModule} from "@angular/material/legacy-chips";
import {MatIconModule} from "@angular/material/icon";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {StoreModule} from "@ngrx/store";

@Component({
  template: `
    i'm a lonely placer
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => NoopPlacer)
    }
  ]
})
class NoopPlacer implements ControlValueAccessor {
  writeValue = jasmine.createSpy("writeValue");
  _change: Function;
  registerOnChange = jasmine.createSpy("registerOnChange").and.callFake(fn => {
    this._change = fn;
  });
  registerOnTouched = jasmine.createSpy("registerOnTouched");
}

describe("FilterComponent", () => {
  let fixture: ComponentFixture<FilterComponent>;
  const applyButtonSelector = ".filter-buttons > button:first-of-type";
  const clearButtonSelector = ".filter-buttons > button:last-of-type";

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        CommonModule,
        MatSelectModule,
        MatInputModule,
        InputModule.withPlacers([
          {
            color: "#fff",
            icon: "format_qoute",
            origin: "string",
            type: "mytype",
            placer: NoopPlacer
          },
          {
            color: "#fff",
            icon: "format_qoute",
            origin: "string",
            type: "date",
            placer: NoopPlacer
          },
          {
            color: "#fff",
            icon: "format_qoute",
            origin: "string",
            type: "relation",
            placer: NoopPlacer
          },
          {
            color: "#fff",
            icon: "format_qoute",
            origin: "string",
            type: "string",
            placer: NoopPlacer
          },
          {
            color: "#fff",
            icon: "format_qoute",
            origin: "string",
            type: "textarea",
            placer: NoopPlacer
          }
        ]),
        NoopAnimationsModule,
        OwlDateTimeModule,
        EditorModule,
        MatChipsModule,
        MatIconModule,
        MatTooltipModule,
        StoreModule.forRoot({})
      ],
      declarations: [FilterComponent, NoopPlacer]
    }).compileComponents();

    fixture = TestBed.createComponent(FilterComponent);
    fixture.componentInstance.schema = {
      _id: "objectid",
      primary: undefined,
      properties: {
        test: {
          type: "mytype"
        },
        test1: {
          type: "date"
        },
        test2: {
          type: "relation"
        },
        title: {
          type: "string"
        },
        description: {
          type: "textarea"
        }
      }
    };
    fixture.componentInstance.ngOnChanges({
      schema: new SimpleChange(undefined, fixture.componentInstance.schema, true)
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(`bucket_objectid_mongodb_filter_history`);
    localStorage.removeItem(`bucket_objectid_expression_filter_history`);
  });

  describe("getTextSearchFilter", () => {
    it("should get filter if schema has searchable properties", () => {
      const schema = {
        properties: {
          title: {
            type: "string"
          },
          description: {
            type: "textarea"
          },
          banner: {
            type: "richtext"
          },
          age: {
            type: "number"
          }
        }
      };

      const text = "hey";

      const expression = fixture.componentInstance.getTextSearchFilter(text, schema);

      expect(expression).toEqual({
        $or: [
          {
            title: {
              $regex: "hey",
              $options: "i"
            }
          },
          {
            description: {
              $regex: "hey",
              $options: "i"
            }
          },
          {
            banner: {
              $regex: "hey",
              $options: "i"
            }
          }
        ]
      });
    });

    it("should return empty filter if text is empty", () => {
      const expression = fixture.componentInstance.getTextSearchFilter("", {});
      expect(expression).toEqual({});
    });

    it("should return empty filter if schema has no searchable property", () => {
      const schema = {
        properties: {
          age: {
            type: "number"
          }
        }
      };

      const text = "hey";

      const expression = fixture.componentInstance.getTextSearchFilter(text, schema);
      expect(expression).toEqual({});
    });
  });

  describe("Basic", () => {
    describe("placer", () => {
      beforeEach(() => {
        fixture.componentInstance.property[0] = "test";
        fixture.componentInstance.selectedOperator[0] = "equals";
        fixture.detectChanges();
      });
      it("should render the value of property", () => {
        const placer = fixture.debugElement.query(By.directive(NoopPlacer));
        expect(placer.nativeElement.textContent).toBe(" i'm a lonely placer ");
      });

      it("should write value to filter", () => {
        const placer = fixture.debugElement.query(By.directive(NoopPlacer));
        placer.componentInstance._change("test1");
        expect(fixture.componentInstance.value[0]).toBe("test1");
      });
    });

    it("should render properties", () => {
      fixture.debugElement.query(By.css("mat-select")).nativeElement.click();
      fixture.detectChanges();
      const properties = document.body.querySelectorAll(".mat-select-panel > mat-option");
      expect(properties[0].textContent).toBe(" description ");
      expect(properties[1].textContent).toBe(" test ");
      expect(properties[2].textContent).toBe(" test1 ");
    });

    it("should render properties with title", () => {
      fixture.componentInstance.schema.properties.test.title = "string title";
      fixture.debugElement.query(By.css("mat-select")).nativeElement.click();
      fixture.detectChanges();
      const property = document.body.querySelectorAll("mat-option")[1];
      expect(property.textContent).toBe(" string title ");
    });

    it("should select the property", () => {
      fixture.debugElement.query(By.css("mat-select")).nativeElement.click();
      fixture.detectChanges();
      const property = document.body.querySelectorAll(
        ".mat-select-panel > mat-option"
      )[1] as HTMLElement;
      property.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.property).toEqual(["test"]);
    });

    it("should render the selected property", () => {
      fixture.componentInstance.property[0] = "test";
      fixture.detectChanges();
      const placer = fixture.debugElement.query(By.directive(NoopPlacer));
      expect(placer).toBeTruthy();
    });

    xit("should render date picker when the selected property is a date", () => {
      fixture.componentInstance.property[0] = "test1";
      fixture.detectChanges();
      const directive = fixture.debugElement
        .query(By.directive(OwlDateTimeInputDirective))
        .injector.get(OwlDateTimeInputDirective);
      expect(directive.selectMode).toBe("range");
    });

    it("should generate the filter", () => {
      fixture.componentInstance.property[0] = "title";
      fixture.componentInstance.selectedOperator[0] = "equals";
      fixture.componentInstance.value[0] = "test1";

      fixture.componentInstance.apply();

      expect(fixture.componentInstance.filter).toEqual({$and: [{title: {$eq: "test1"}}]});
    });

    it("should generate the filter with operator", () => {
      fixture.componentInstance.property[0] = "title";
      fixture.componentInstance.selectedOperator[0] = "includes";
      fixture.componentInstance.value[0] = "test1";

      fixture.componentInstance.apply();

      expect(fixture.componentInstance.filter).toEqual({
        $and: [{title: {$regex: "test1", $options: "i"}}]
      });
    });

    it("should generate the filter with date", () => {
      fixture.componentInstance.property[0] = "test1";
      fixture.componentInstance.selectedOperator[0] = "between";
      fixture.componentInstance.value[0] = [
        new Date("2020-04-20T10:00:00.000Z"),
        new Date("2020-05-20T10:00:00.000Z")
      ];

      fixture.componentInstance.apply();

      expect(fixture.componentInstance.filter).toEqual({
        $and: [
          {
            test1: {$gte: "Date(2020-04-20T10:00:00.000Z)", $lt: "Date(2020-05-20T10:00:00.000Z)"}
          }
        ]
      });
    });

    it("should generate the filter for onetomany relation", () => {
      fixture.componentInstance.schema.properties.test2["relationType"] = "onetomany";
      fixture.componentInstance.property[0] = "test2";
      fixture.componentInstance.value[0] = ["anobjectid"];

      fixture.componentInstance.apply();
      expect(fixture.componentInstance.filter).toEqual({
        $and: [
          {
            "test2._id": {
              $in: ["anobjectid"]
            }
          }
        ]
      });
    });

    it("should generate the filter for onetoone relation", () => {
      fixture.componentInstance.schema.properties.test2["relationType"] = "onetoone";
      fixture.componentInstance.property[0] = "test2";
      fixture.componentInstance.value[0] = "anobjectid";

      fixture.componentInstance.apply();

      expect(fixture.componentInstance.filter).toEqual({
        $and: [
          {
            "test2._id": "anobjectid"
          }
        ]
      });
    });

    it("should create multiple filters", () => {
      fixture.componentInstance.property = ["title", "title"];
      fixture.componentInstance.selectedOperator = ["includes", "not_equal"];
      fixture.componentInstance.value = ["dragon", "revenge of dragon"];

      fixture.componentInstance.apply();

      expect(fixture.componentInstance.filter).toEqual({
        $and: [
          {
            title: {
              $regex: "dragon",
              $options: "i"
            }
          },
          {
            title: {
              $ne: "revenge of dragon"
            }
          }
        ]
      });
    });
  });

  describe("MongoDB", () => {
    beforeEach(() => {
      // switch to the mongodb filter
      fixture.debugElement
        .query(By.css("div.labels > button:nth-of-type(2)"))
        .nativeElement.click();
      fixture.detectChanges();
    });
    it("should generate the mongodb filter, add it to the history", () => {
      fixture.componentInstance.value[0] = '{"test":"value"}';
      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.filter).toEqual({test: "value"});
      expect(fixture.componentInstance.mongodbHistory).toEqual(['{"test":"value"}']);

      const mongodbHistory = JSON.parse(
        localStorage.getItem(`bucket_objectid_mongodb_filter_history`)
      );
      expect(mongodbHistory).toEqual(['{"test":"value"}']);
    });

    it("should show error of mongodb filter if json.parse fails, and should not write it to the storage", fakeAsync(() => {
      fixture.componentInstance.value[0] = "{";

      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("p.mat-error")).nativeElement.textContent).toContain(
        "SyntaxError"
      );

      expect(fixture.componentInstance.filter).toEqual(undefined);
      expect(fixture.componentInstance.mongodbHistory).toEqual([]);

      const mongodbHistory = JSON.parse(
        localStorage.getItem(`bucket_objectid_mongodb_filter_history`)
      );
      expect(mongodbHistory).toEqual(null);

      // remove the error from UI after 3 seconds
      tick(3001);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("p.mat-error"))).toEqual(null);
    }), 10000);
  });

  describe("Expression", () => {
    it("should generate the expression filter, add it to the history", () => {
      fixture.debugElement
        .query(By.css("div.labels > button:nth-of-type(3)"))
        .nativeElement.click();

      fixture.componentInstance.value[0] = 'document.title == "test"';

      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.filter).toEqual('document.title == "test"');
      expect(fixture.componentInstance.expressionHistory).toEqual(['document.title == "test"']);

      const expressionFilter = JSON.parse(
        localStorage.getItem(`bucket_objectid_expression_filter_history`)
      );
      expect(expressionFilter).toEqual(['document.title == "test"']);
    });
  });

  describe("apply and clear", () => {
    const changeSpy = jasmine.createSpy("changeSpy");

    beforeEach(() => {
      fixture.componentInstance.resetInputs();
      fixture.componentInstance.filterChange.subscribe(changeSpy);

      fixture.componentInstance.property[0] = "title";
      fixture.componentInstance.selectedOperator[0] = "equals";
      fixture.componentInstance.value[0] = "test1";
    });

    it("should emit filter", () => {
      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();
      const expectation = {
        $and: [{title: {$eq: "test1"}}]
      };
      expect(fixture.componentInstance.filter).toEqual(expectation);
      expect(changeSpy).toHaveBeenCalledWith(expectation);
    });

    it("should clear filter and emit", () => {
      changeSpy.calls.reset();
      fixture.debugElement.query(By.css(clearButtonSelector)).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.filter).toBeUndefined();
      expect(changeSpy).toHaveBeenCalledWith(undefined);
    });

    it("should keep history length 10", () => {
      const histories = Array.from(new Array(10), (_, index) => (10 - index).toString());

      fixture.componentInstance.addToHistory(histories, "11");
      expect(histories[0]).toEqual("11");
      expect(histories[1]).toEqual("10");

      expect(histories[8]).toEqual("3");
      expect(histories[9]).toEqual("2");
    });
  });
});
