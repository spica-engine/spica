import {Component, Inject} from "@angular/core";
import {INPUT_SCHEMA, InputSchema} from "../../input";
import {
  PredefinedEnum,
  PredefinedOption,
  PredefinedOptionLoader,
  PredefinedOptionType,
  PredefinedPattern,
  STRING_PREDEFINED_OPTION_LOADER
} from "../../input-schema-placer/predefineds";
import {SchemaComponent} from "../schema.component";

@Component({
  templateUrl: "./string-schema.component.html",
  styleUrls: ["./string-schema.component.scss"]
})
export class StringSchemaComponent extends SchemaComponent {
  enumOptions: PredefinedEnum[] = [];
  selectedEnums: PredefinedEnum[] = [];
  isEnumEnabled = false;

  patternOptions: PredefinedPattern[] = [];
  selectedPatterns: PredefinedPattern[] = [];
  isPatternEnabled = false;

  predefineds: PredefinedOption[] = [];
  selectedPredefineds: PredefinedOption[] = [];

  readonly PATTERN_SEPERATOR = "|";

  constructor(
    @Inject(INPUT_SCHEMA) public schema: InputSchema,
    @Inject(STRING_PREDEFINED_OPTION_LOADER)
    loader: PredefinedOptionLoader
  ) {
    super(schema);

    this.predefineds = loader.list();
    this.selectedEnums = this.getOptions(
      this.predefineds,
      PredefinedOptionType.ENUM
    ) as PredefinedEnum[];
    this.selectedPatterns = this.getOptions(
      this.predefineds,
      PredefinedOptionType.PATTERN
    ) as PredefinedPattern[];

    // this.enumOptions = loader.list(PredefinedOptionType.ENUM);
    // this.patternOptions = loader.list(PredefinedOptionType.PATTERN);

    // if (this.schema.enum) {
    //   this.isEnumEnabled = true;
    //   this.selectedEnums = this.findSelecteds(this.enumOptions, this.schema.enum as string[]);
    // }
    // if (this.schema.pattern) {
    //   this.isPatternEnabled = true;
    //   this.selectedPatterns = this.findSelecteds(
    //     this.patternOptions,
    //     this.seperatePattern(this.schema.pattern)
    //   );
    // }
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
    this.selectedPredefineds = this.selectedPredefineds.filter(
      p => p.type != PredefinedOptionType.ENUM
    );
    delete this.schema.enum;
  }

  removePattern() {
    this.isPatternEnabled = false;
    this.selectedPatterns = [];
    this.selectedPredefineds = this.selectedPredefineds.filter(
      p => p.type != PredefinedOptionType.PATTERN
    );
    delete this.schema.pattern;
  }

  onOptionSelected(options: PredefinedOption[]) {
    const enums = this.getOptions(options, PredefinedOptionType.ENUM);
    const patterns = this.getOptions(options, PredefinedOptionType.PATTERN);

    this.onEnumOptionSelected(enums);
    this.onPatternOptionSelected(patterns);
  }

  onEnumOptionSelected(enums: PredefinedEnum[]) {
    const addedValues = this.getAddedOptionValues(this.selectedEnums, enums);
    const removedValues = this.getRemovedOptionValues(this.selectedEnums, enums);

    this.initEnum();
    this.schema.enum = this.schema.enum.concat(...addedValues);
    this.schema.enum = (this.schema.enum as string[]).filter(e => !removedValues.includes(e));

    this.selectedEnums = enums;

    this.isEnumEnabled = !!this.schema.enum.length;
  }

  onPatternOptionSelected(patterns: PredefinedPattern[]) {
    const addedValues = this.getAddedOptionValues(this.selectedPatterns, patterns);
    const removedValues = this.getRemovedOptionValues(this.selectedPatterns, patterns);

    this.initPattern();
    this.schema.pattern = this.joinPatterns([
      ...this.seperatePattern(this.schema.pattern),
      ...addedValues
    ]);
    this.schema.pattern = this.joinPatterns(
      this.seperatePattern(this.schema.pattern).filter(p => !removedValues.includes(p))
    );

    this.selectedPatterns = patterns;

    this.isPatternEnabled = !!this.schema.pattern.length;
  }

  getAddedOptionValues(previos: PredefinedOption[], current: PredefinedOption[]): string[] {
    return [].concat(
      ...current.filter(c => !previos.some(p => p.title == c.title)).map(e => e.values)
    );
  }

  getRemovedOptionValues(previos: PredefinedOption[], current: PredefinedOption[]): string[] {
    return [].concat(
      ...previos.filter(p => !current.some(c => c.title == p.title)).map(e => e.values)
    );
  }

  findSelecteds(options: PredefinedEnum[], values: string[]): PredefinedEnum[];
  findSelecteds(options: PredefinedPattern[], values: string[]): PredefinedPattern[];
  findSelecteds(options: PredefinedOption[], values: string[]) {
    return options.filter(o => o.values.every(val => values.includes(val)));
  }

  getOptions(options: PredefinedOption[], type: PredefinedOptionType.ENUM): PredefinedEnum[];
  getOptions(options: PredefinedOption[], type: PredefinedOptionType.PATTERN): PredefinedPattern[];
  getOptions(options: PredefinedOption[], type: PredefinedOptionType) {
    return options.filter(o => o.type == type);
  }

  private seperatePattern(pattern: string) {
    return pattern.split(this.PATTERN_SEPERATOR).filter(p => p != "");
  }

  private joinPatterns(patterns: string[]) {
    return patterns.filter(p => p != "").join(this.PATTERN_SEPERATOR);
  }
}
