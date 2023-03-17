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

  readonly PATTERN_SEPERATOR = "|";

  constructor(
    @Inject(INPUT_SCHEMA) public schema: InputSchema,
    @Inject(STRING_PREDEFINED_OPTION_LOADER)
    loader: PredefinedOptionLoader
  ) {
    super(schema);

    this.enumOptions = loader.list(PredefinedOptionType.ENUM);
    this.patternOptions = loader.list(PredefinedOptionType.PATTERN);

    if (this.schema.enum) {
      this.isEnumEnabled = true;
      this.selectedEnums = this.findSelecteds(this.enumOptions, this.schema.enum as string[]);
    }
    if (this.schema.pattern) {
      this.isPatternEnabled = true;
      this.selectedPatterns = this.findSelecteds(
        this.patternOptions,
        this.seperatePattern(this.schema.pattern)
      );
    }
  }

  removeEnum() {
    this.selectedEnums = [];
    delete this.schema.enum;
  }

  removePattern() {
    this.selectedPatterns = [];
    delete this.schema.pattern;
  }

  onEnumOptionSelected(enums: PredefinedEnum[]) {
    const addedValues = this.getAddedOptionValues(this.selectedEnums, enums);
    const removedValues = this.getRemovedOptionValues(this.selectedEnums, enums);

    this.schema.enum = (this.schema.enum || []).concat(...addedValues);
    this.schema.enum = (this.schema.enum as string[]).filter(e => !removedValues.includes(e));

    this.selectedEnums = enums;
  }

  onPatternOptionSelected(patterns: PredefinedPattern[]) {
    const addedValues = this.getAddedOptionValues(this.selectedPatterns, patterns);
    const removedValues = this.getRemovedOptionValues(this.selectedPatterns, patterns);

    this.schema.pattern = this.joinPatterns([
      ...this.seperatePattern(this.schema.pattern),
      ...addedValues
    ]);
    this.schema.pattern = this.joinPatterns(
      this.seperatePattern(this.schema.pattern).filter(p => !removedValues.includes(p))
    );

    this.selectedPatterns = patterns;
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

  private seperatePattern(pattern: string) {
    return pattern.split(this.PATTERN_SEPERATOR).filter(p => p != "");
  }

  private joinPatterns(patterns: string[]) {
    return patterns.filter(p => p != "").join(this.PATTERN_SEPERATOR);
  }
}
