export interface IPredefinedOptionLoader<T> {
  add(options: PredefinedOption<T>[]);
  list(type: string): PredefinedOption<T>[];
}

export class PredefinedOptionLoader<T> implements IPredefinedOptionLoader<T> {
  private options: PredefinedOption<T>[] = [];

  add(options: PredefinedOption<T>[]) {
    this.options.push(...options);
  }

  list(type: string) {
    return this.options.filter(option => option.type == type);
  }
}

export interface PredefinedOption<T> {
  title: string;
  type: PredefinedOptionType;
  values: T[];
}

export enum PredefinedOptionType {
  ENUM = "enum",
  REGEX = "regex"
}

export interface PredefinedEnum extends PredefinedOption<string> {
  type: PredefinedOptionType.ENUM;
}

export interface PredefinedRegex extends PredefinedOption<string> {
  type: PredefinedOptionType.REGEX;
}
