import {ComponentFixture, fakeAsync, TestBed, tick, waitForAsync} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatLegacyFormFieldModule as MatFormFieldModule} from "@angular/material/legacy-form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {MatLegacySlideToggleModule as MatSlideToggleModule} from "@angular/material/legacy-slide-toggle";
import {By} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {InputModule, INPUT_SCHEMA} from "../..";
import {
  EnumPreset,
  PatternPreset,
  Preset,
  PresetLoader,
  PresetType,
  STRING_PRESET_LOADER
} from "../../input-schema-placer/predefineds";
import {StringSchemaComponent} from "./string-schema.component";

describe("Common#string-schema", () => {
  let component: StringSchemaComponent;
  let fixture: ComponentFixture<StringSchemaComponent>;
  let ratings: EnumPreset = {
    type: PresetType.ENUM,
    title: "rating",
    values: ["1", "2", "3", "4", "5"]
  };
  let username: PatternPreset = {
    type: PresetType.PATTERN,
    title: "username",
    values: ["\\w"]
  };
  let presets: Preset[] = [ratings, username];

  beforeEach(
    waitForAsync(() => {
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
          },
          {
            provide: STRING_PRESET_LOADER,
            useFactory: () => {
              const loader = new PresetLoader();
              loader.add(presets);
              return loader;
            }
          }
        ]
      }).compileComponents();
      fixture = TestBed.createComponent(StringSchemaComponent);
      component = fixture.componentInstance;
    })
  );

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

  describe("presets", () => {
    describe("selection", () => {
      it("should update variables on ratings selected", () => {
        component.onPresetSelected([ratings]);

        expect(component.selectedEnums).toEqual([ratings]);
        expect(component.selectedPatterns).toEqual([]);

        expect(component.isEnumEnabled).toEqual(true);
        expect(component.isPatternEnabled).toEqual(false);

        expect(component.schema.enum).toEqual(["1", "2", "3", "4", "5"]);
        expect(component.schema.pattern).toBeUndefined();
      });

      it("should update variables on username selected", () => {
        component.onPresetSelected([username]);

        expect(component.selectedEnums).toEqual([]);
        expect(component.selectedPatterns).toEqual([username]);

        expect(component.isEnumEnabled).toEqual(false);
        expect(component.isPatternEnabled).toEqual(true);

        expect(component.schema.enum).toBeUndefined();
        expect(component.schema.pattern).toEqual("\\w");
      });

      it("should update variables on both selected", () => {
        component.onPresetSelected([ratings, username]);

        expect(component.selectedEnums).toEqual([ratings]);
        expect(component.selectedPatterns).toEqual([username]);

        expect(component.isEnumEnabled).toEqual(true);
        expect(component.isPatternEnabled).toEqual(true);

        expect(component.schema.enum).toEqual(["1", "2", "3", "4", "5"]);
        expect(component.schema.pattern).toEqual("\\w");
      });
    });

    describe("deselection", () => {
      beforeEach(() => {
        component.onPresetSelected([ratings, username]);
      });

      it("should update variables on ratings deselected", () => {
        component.onPresetSelected([username]);

        expect(component.selectedEnums).toEqual([]);
        expect(component.selectedPatterns).toEqual([username]);

        expect(component.isEnumEnabled).toEqual(false);
        expect(component.isPatternEnabled).toEqual(true);

        expect(component.schema.enum).toBeUndefined();
        expect(component.schema.pattern).toEqual("\\w");
      });

      it("should update variables on username deselected", () => {
        component.onPresetSelected([ratings]);

        expect(component.selectedEnums).toEqual([ratings]);
        expect(component.selectedPatterns).toEqual([]);

        expect(component.isEnumEnabled).toEqual(true);
        expect(component.isPatternEnabled).toEqual(false);

        expect(component.schema.enum).toEqual(["1", "2", "3", "4", "5"]);
        expect(component.schema.pattern).toBeUndefined();
      });

      it("should update variables on both deselected", () => {
        component.onPresetSelected([]);

        expect(component.selectedEnums).toEqual([]);
        expect(component.selectedPatterns).toEqual([]);

        expect(component.isEnumEnabled).toEqual(false);
        expect(component.isPatternEnabled).toEqual(false);

        expect(component.schema.enum).toBeUndefined();
        expect(component.schema.pattern).toBeUndefined();
      });
    });

    it("shoud keep custom enums on preset selection/deselection", () => {
      component.schema.enum = ["test"];

      component.onPresetSelected([ratings]);
      expect(component.schema.enum).toEqual(["test", "1", "2", "3", "4", "5"]);

      component.onPresetSelected([]);
      expect(component.schema.enum).toEqual(["test"]);
    });

    it("shoud keep custom pattern on preset selection/deselection", () => {
      component.schema.pattern = "test";

      component.onPresetSelected([username]);
      expect(component.schema.pattern).toEqual("test|\\w");

      component.onPresetSelected([]);
      expect(component.schema.pattern).toEqual("test");
    });
  });
});
