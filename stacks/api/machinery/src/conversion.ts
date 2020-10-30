import {Scheme} from "./scheme";

export interface Conversion {
  from: string;
  to: string;
  convert: ConversionFunc;
}

export type ConversionFunc = (iin: unknown, out: unknown) => void;

export class ConversionError extends Error {}

export const INTERNAL_VERSION = "__internal";

export function convert({
  from,
  to,
  scheme,
  iin,
  out
}: {
  from: string;
  to: string;
  scheme: Scheme;
  iin: unknown;
  out: unknown;
}): ConversionError | true {
  if (!scheme.conversion) {
    return new ConversionError(`conversion is not possible from ${from} to ${to}`);
  }

  for (const conversion of scheme.conversion) {
    if (conversion.from == from && conversion.to == to) {
      conversion.convert(iin, out);
      return true;
    }
  }
  return new ConversionError(`conversion is not possible from ${from} to ${to}`);
}
