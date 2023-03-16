import {
  PredefinedEnum,
  PredefinedOption,
  PredefinedRegex,
  PredefinedOptionType,
  PredefinedOptionLoader
} from "../../../input-schema-placer/predefineds/interface";
import {InjectionToken} from "@angular/core";

const CountryEnum: PredefinedEnum = {
  title: "country",
  type: PredefinedOptionType.ENUM,
  values: ["England", "USA", "Turkey"]
};

const EmailRegex: PredefinedRegex = {
  title: "email",
  type: PredefinedOptionType.REGEX,
  values: ["/^S+@S+.S+$/"]
};

export const predefinedOptions: PredefinedOption<string>[] = [CountryEnum, EmailRegex];

export const STRING_PREDEFINED_OPTION_LOADER = new InjectionToken<any>(
  "STRING_PREDEFINED_OPTION_LOADER"
);
