/**
 * Field Presets (Enumeration & Regex)
 * ------------------------------------------------------------
 * Central source for predefined enumeration value sets and
 * regular expression presets previously defined in
 * `BucketAddFieldPresets.ts` (UI layer). Moving these into the
 * domain enables pure, deterministic transformation logic and
 * eliminates UI-owned business data.
 *
 * NOTE (Step 1): UI still references the old file; do NOT delete
 * the legacy `BucketAddFieldPresets.ts` until cleanup step.
 */

// ---------------------------------------------------------------------------
// Enumeration Presets
// ---------------------------------------------------------------------------

const Countries = [
  "United States",
  "Canada",
  "Afghanistan",
  "Albania",
  "Algeria",
  "American Samoa",
  "Andorra",
  "Angola",
  "Anguilla",
  "Antarctica",
  "Antigua and/or Barbuda",
  "Argentina",
  "Armenia",
  "Aruba",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bermuda",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Bouvet Island",
  "Brazil",
  "British Indian Ocean Territory",
  "Brunei Darussalam",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Cape Verde",
  "Cayman Islands",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Christmas Island",
  "Cocos (Keeling) Islands",
  "Colombia",
  "Comoros",
  "Congo",
  "Cook Islands",
  "Costa Rica",
  "Croatia (Hrvatska)",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "East Timor",
  "Ecudaor",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Ethiopia",
  "Falkland Islands (Malvinas)",
  "Faroe Islands",
  "Fiji",
  "Finland",
  "France",
  "France, Metropolitan",
  "French Guiana",
  "French Polynesia",
  "French Southern Territories",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Gibraltar",
  "Greece",
  "Greenland",
  "Grenada",
  "Guadeloupe",
  "Guam",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Heard and Mc Donald Islands",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran (Islamic Republic of)",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Ivory Coast",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Korea, Democratic People's Republic of",
  "Korea, Republic of",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Lao People's Democratic Republic",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libyan Arab Jamahiriya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macau",
  "Macedonia",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Martinique",
  "Mauritania",
  "Mauritius",
  "Mayotte",
  "Mexico",
  "Micronesia, Federated States of",
  "Moldova, Republic of",
  "Monaco",
  "Mongolia",
  "Montserrat",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "Netherlands Antilles",
  "New Caledonia",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "Niue",
  "Norfork Island",
  "Northern Mariana Islands",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Pitcairn",
  "Poland",
  "Portugal",
  "Puerto Rico",
  "Qatar",
  "Reunion",
  "Romania",
  "Russian Federation",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Georgia South Sandwich Islands",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "St. Helena",
  "St. Pierre and Miquelon",
  "Sudan",
  "Suriname",
  "Svalbarn and Jan Mayen Islands",
  "Swaziland",
  "Sweden",
  "Switzerland",
  "Syrian Arab Republic",
  "Taiwan",
  "Tajikistan",
  "Tanzania, United Republic of",
  "Thailand",
  "Togo",
  "Tokelau",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Turks and Caicos Islands",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States minor outlying islands",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City State",
  "Venezuela",
  "Vietnam",
  "Virigan Islands (British)",
  "Virgin Islands (U.S.)",
  "Wallis and Futuna Islands",
  "Western Sahara",
  "Yemen",
  "Yugoslavia",
  "Zaire",
  "Zambia",
  "Zimbabwe"
];

const Days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const ENUM_PRESETS = { Countries, Days } as const;

// ---------------------------------------------------------------------------
// Regex Presets
// ---------------------------------------------------------------------------

// Using RegExp objects for early validation & explicitness.
const Email = /^\w+@\w+\.\w+$/; // simple email format (legacy parity)
const PhoneNumber = /^[0-9-+\s]+$/; // digits, spaces, plus, hyphen

export const REGEX_PRESETS = { Email, "Phone Number": PhoneNumber } as const;

// ---------------------------------------------------------------------------
// Types & Type Guards
// ---------------------------------------------------------------------------

export type EnumerationPresetKey = keyof typeof ENUM_PRESETS;
export type RegexPresetKey = keyof typeof REGEX_PRESETS;
export type PresetKey = EnumerationPresetKey | RegexPresetKey;

export function isEnumPreset(k: string): k is EnumerationPresetKey {
  return Object.prototype.hasOwnProperty.call(ENUM_PRESETS, k);
}

export function isRegexPreset(k: string): k is RegexPresetKey {
  return Object.prototype.hasOwnProperty.call(REGEX_PRESETS, k);
}

// ---------------------------------------------------------------------------
// Access Helpers
// ---------------------------------------------------------------------------

export function getEnumerationPreset(key: EnumerationPresetKey) {
  return ENUM_PRESETS[key];
}

export function getRegexPreset(key: RegexPresetKey) {
  return REGEX_PRESETS[key];
}

export function classifyPreset(key: string): "enum" | "regex" | undefined {
  if (isEnumPreset(key)) return "enum";
  if (isRegexPreset(key)) return "regex";
  return undefined;
}

// ---------------------------------------------------------------------------
// Transformation Helper (non-mutating)
// (Actual application logic added in Step 2 – placeholder intent only.)
// ---------------------------------------------------------------------------

import { BASE_PRESET_DEFAULTS } from "./defaults";
import { FieldKind, type FieldFormState } from "./types";

export interface ApplyPresetContext {
  enforceResetOutsideStringContext?: boolean; // default true
}

/** Result of preset logic application */
export interface PresetApplicationResult<TForm> {
  form: TForm;
  applied?: boolean;
  kind?: "enum" | "regex";
  reset?: boolean; // indicates preset section was reset (context not applicable)
}

/**
 * Pure function that applies preset semantics to a form state.
 * Mirrors / consolidates legacy useEffect chains in BucketAddFieldBusiness.
 */
export function applyPresetLogic(kind: FieldKind, form: FieldFormState, ctx: ApplyPresetContext = {}): PresetApplicationResult<FieldFormState> {
  const options = { enforceResetOutsideStringContext: true, ...ctx };
  const isStringContext = kind === FieldKind.String || (kind === FieldKind.Array && form.fieldValues?.arrayType === "string");
  let changed = false;
  let reset = false;
  const originalPresetKey = form.presetValues?.preset || "";

  // Start from shallow clones to avoid mutating caller state
  let next: FieldFormState = {
    ...form,
    fieldValues: { ...form.fieldValues },
    presetValues: { ...form.presetValues }
  };

  // 1. Context reset: if not a string context and previous state carried custom presets
  if (!isStringContext && options.enforceResetOutsideStringContext) {
    const needsReset = Object.keys(next.presetValues || {}).some(k => (next.presetValues as any)[k] !== (BASE_PRESET_DEFAULTS as any)[k]);
    if (needsReset) {
      next = { ...next, presetValues: { ...BASE_PRESET_DEFAULTS } } as FieldFormState;
      changed = true; reset = true;
    }
    return { form: next, applied: changed, reset };
  }

  // If no preset selected, still enforce logical cleanup from toggle changes below
  if (!originalPresetKey) {
    // Handle toggles clearing lingering arrays/pattern when user turned them off after selecting preset earlier.
    next = enforceToggleCleanup(next, originalPresetKey);
    return { form: next, applied: changed };
  }

  // 2. Apply selected preset semantics when in valid context
  if (isEnumPreset(originalPresetKey)) {
    const values = getEnumerationPreset(originalPresetKey as EnumerationPresetKey);
    next.presetValues.makeEnumerated = true;
    next.presetValues.definePattern = false;
    next.presetValues.enumeratedValues = [...values];
    next.presetValues.regularExpression = "";
    changed = true;
  } else if (isRegexPreset(originalPresetKey)) {
    const regex = getRegexPreset(originalPresetKey as RegexPresetKey);
    next.presetValues.definePattern = true;
    next.presetValues.makeEnumerated = false;
    next.presetValues.regularExpression = regex.source; // store as string (matches legacy)
    next.presetValues.enumeratedValues = [];
    changed = true;
  }

  // 3. Apply toggle-driven cleanups (user may have disabled enumeration/pattern after preset set)
  next = enforceToggleCleanup(next, originalPresetKey);

  return {
    form: next,
    applied: changed,
    kind: isEnumPreset(originalPresetKey) ? "enum" : isRegexPreset(originalPresetKey) ? "regex" : undefined,
    reset
  };
}

/**
 * Helper: ensures when enumeration/pattern toggles are disabled the related
 * fields/preset key are cleared in line with legacy behavior.
 */
function enforceToggleCleanup(form: FieldFormState, presetKey: string): FieldFormState {
  let modified = false;
  let next = form;
  const pv = form.presetValues || {};
  // Enumeration toggle off
  if (!pv.makeEnumerated && pv.enumeratedValues?.length && isEnumPreset(presetKey)) {
    next = { ...next, presetValues: { ...pv, enumeratedValues: [], preset: "" } } as FieldFormState;
    modified = true;
  }
  // Pattern toggle off
  if (!pv.definePattern && pv.regularExpression && isRegexPreset(presetKey)) {
    next = { ...next, presetValues: { ...next.presetValues, regularExpression: "", preset: "" } } as FieldFormState;
    modified = true;
  }
  return modified ? next : form;
}

// Optional exported togglers (may be used by UI if needed later)
export function clearPreset(kind: FieldKind, form: FieldFormState): FieldFormState {
  return { ...form, presetValues: { ...BASE_PRESET_DEFAULTS } };
}

export function forceEnumeration(kind: FieldKind, form: FieldFormState): FieldFormState {
  if (!(kind === FieldKind.String || (kind === FieldKind.Array && form.fieldValues?.arrayType === "string"))) return form;
  return { ...form, presetValues: { ...form.presetValues, makeEnumerated: true } };
}

export function forcePattern(kind: FieldKind, form: FieldFormState): FieldFormState {
  if (!(kind === FieldKind.String || (kind === FieldKind.Array && form.fieldValues?.arrayType === "string"))) return form;
  return { ...form, presetValues: { ...form.presetValues, definePattern: true } };
}

// End of Step 2 implementation.
