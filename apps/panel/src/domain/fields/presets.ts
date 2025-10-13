import {FieldKind, type FieldCreationForm} from "./types";

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

export const ENUM_PRESETS = {Countries, Days} as const;

const Email = /^\w+@\w+\.\w+$/;
const PhoneNumber = /^[0-9-+\s]+$/;

export const REGEX_PRESETS = {Email, "Phone Number": PhoneNumber} as const;

export type EnumerationPresetKey = keyof typeof ENUM_PRESETS;
export type RegexPresetKey = keyof typeof REGEX_PRESETS;

export function applyPresetLogic(kind: FieldKind, form: FieldCreationForm, oldValues: FieldCreationForm): FieldCreationForm {
  const isStringContext =
    kind === FieldKind.String ||
    (kind === FieldKind.Array && form.fieldValues?.arrayType === "string");

  const curr = form.presetValues || {};
  const prev = oldValues?.presetValues || {};

  const presetKey = curr.preset || "";
  const presetExists = !!presetKey;

  let next: FieldCreationForm = {
    ...form,
    fieldValues: {...form.fieldValues},
    presetValues: {...curr}
  };

  if (!isStringContext) return next;

  const togglesChanged =
    prev.makeEnumerated !== curr.makeEnumerated ||
    prev.definePattern !== curr.definePattern;

  if (presetExists && !togglesChanged) {
    if (ENUM_PRESETS[presetKey as EnumerationPresetKey]) {
      const values = ENUM_PRESETS[presetKey as EnumerationPresetKey];
      next.presetValues.makeEnumerated = true;
      next.presetValues.definePattern = false;
      next.presetValues.enumeratedValues = [...values];
      next.presetValues.pattern = "";
    } else if (REGEX_PRESETS[presetKey as RegexPresetKey]) {
      const regex = REGEX_PRESETS[presetKey as RegexPresetKey];
      next.presetValues.definePattern = true;
      next.presetValues.makeEnumerated = false;
      next.presetValues.enumeratedValues = [];
      next.presetValues.pattern = regex.source;
    }
  }

  next = enforceToggleCleanup(next, presetKey);

  return next;
}

function enforceToggleCleanup(form: FieldCreationForm, presetKey: string): FieldCreationForm {
  const curr = form?.presetValues || {};
  if (!presetKey) return form;

  let next = form;

  if (ENUM_PRESETS[presetKey as EnumerationPresetKey] && !curr.makeEnumerated) {
    next = {
      ...next,
      presetValues: {
        ...curr,
        enumeratedValues: [],
        preset: ""
      }
    } as FieldCreationForm;
  }

  if (REGEX_PRESETS[presetKey as RegexPresetKey] && !curr.definePattern) {
    next = {
      ...next,
      presetValues: {
        ...next.presetValues,
        pattern: "",
        preset: ""
      }
    } as FieldCreationForm;
  }

  return next;
}