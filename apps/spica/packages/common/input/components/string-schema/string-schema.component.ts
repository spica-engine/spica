import {Component, Inject} from "@angular/core";
import {INPUT_SCHEMA, InputSchema} from "../../input";
import {
  EnumPreset,
  Preset,
  PresetLoader,
  PresetType,
  PatternPreset,
  STRING_PRESET_LOADER
} from "../../input-schema-placer/predefineds";
import {SchemaComponent} from "../schema.component";

@Component({
  templateUrl: "./string-schema.component.html",
  styleUrls: ["./string-schema.component.scss"]
})
export class StringSchemaComponent extends SchemaComponent {
  enums: EnumPreset[] = [];
  selectedEnums: EnumPreset[] = [];
  isEnumEnabled = false;

  patterns: PatternPreset[] = [];
  selectedPatterns: PatternPreset[] = [];
  isPatternEnabled = false;

  presets: Preset[] = [];
  selectedPresets: Preset[] = [];

  readonly PATTERN_SEPERATOR = "|";

  constructor(
    @Inject(INPUT_SCHEMA) public schema: InputSchema,
    @Inject(STRING_PRESET_LOADER)
    loader: PresetLoader
  ) {
    super(schema);

    this.presets = loader.list();

    const selectedEnumValues = (this.schema.enum || []) as string[];
    const selectedPatternValues = this.seperatePattern(this.schema.pattern || "");
    this.selectedPresets = this.findSelecteds(this.presets, [
      ...selectedEnumValues,
      ...selectedPatternValues
    ]);

    this.onPresetSelected(this.selectedPresets);
  }

  initEnum() {
    this.schema.enum = this.schema.enum || [];
  }

  initPattern() {
    this.schema.pattern = this.schema.pattern || "";
  }

  removeEnum() {
    this.isEnumEnabled = false;
    this.selectedEnums = [];
    this.selectedPresets = this.selectedPresets.filter(p => p.type != PresetType.ENUM);
    delete this.schema.enum;
  }

  removePattern() {
    this.isPatternEnabled = false;
    this.selectedPatterns = [];
    this.selectedPresets = this.selectedPresets.filter(p => p.type != PresetType.PATTERN);
    delete this.schema.pattern;
  }

  onPresetSelected(presets: Preset[]) {
    const enums = this.filterPresets(presets, PresetType.ENUM);
    const patterns = this.filterPresets(presets, PresetType.PATTERN);

    this.onEnumPresetSelected(enums);
    this.onPatternPresetSelected(patterns);
  }

  onEnumPresetSelected(enums: EnumPreset[]) {
    const insertedValues = this.getInsertedValues(this.selectedEnums, enums);
    if (insertedValues.length) {
      this.initEnum();
      this.schema.enum = this.schema.enum.concat(...insertedValues);
    }

    const removedValues = this.getRemovedValues(this.selectedEnums, enums);
    if (removedValues.length) {
      this.schema.enum = (this.schema.enum as string[]).filter(e => !removedValues.includes(e));
    }

    this.selectedEnums = enums;

    this.isEnumEnabled = !!(this.schema.enum && this.schema.enum.length);

    if (!this.isEnumEnabled) {
      this.removeEnum();
    }
  }

  onPatternPresetSelected(patterns: PatternPreset[]) {
    const insertedValues = this.getInsertedValues(this.selectedPatterns, patterns);
    if (insertedValues.length) {
      this.initPattern();
      this.schema.pattern = this.joinPatterns([
        ...this.seperatePattern(this.schema.pattern),
        ...insertedValues
      ]);
    }

    const removedValues = this.getRemovedValues(this.selectedPatterns, patterns);
    if (removedValues.length) {
      this.schema.pattern = this.joinPatterns(
        this.seperatePattern(this.schema.pattern).filter(p => !removedValues.includes(p))
      );
    }

    this.selectedPatterns = patterns;

    this.isPatternEnabled = !!(this.schema.pattern && this.schema.pattern.length);

    if (!this.isPatternEnabled) {
      this.removePattern();
    }
  }

  getInsertedValues(previos: Preset[], current: Preset[]): string[] {
    return [].concat(
      ...current.filter(c => !previos.some(p => p.title == c.title)).map(e => e.values)
    );
  }

  getRemovedValues(previos: Preset[], current: Preset[]): string[] {
    return [].concat(
      ...previos.filter(p => !current.some(c => c.title == p.title)).map(e => e.values)
    );
  }

  findSelecteds(options: Preset[], values: string[]): Preset[] {
    return options.filter(o => o.values.every(val => values.includes(val)));
  }

  filterPresets(options: Preset[], type: PresetType.ENUM): EnumPreset[];
  filterPresets(options: Preset[], type: PresetType.PATTERN): PatternPreset[];
  filterPresets(options: Preset[], type: PresetType) {
    return options.filter(o => o.type == type);
  }

  private seperatePattern(pattern: string) {
    return pattern.split(this.PATTERN_SEPERATOR).filter(p => p != "");
  }

  private joinPatterns(patterns: string[]) {
    return patterns.filter(p => p != "").join(this.PATTERN_SEPERATOR);
  }
}
