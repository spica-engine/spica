export const configuration: import("monaco-editor-core").languages.LanguageConfiguration = {
  // symbols used as brackets
  brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
  // symbols that are auto closed when typing
  autoClosingPairs: [
    {open: "{", close: "}"},
    {open: "[", close: "]"},
    {open: "(", close: ")"},
    {open: '"', close: '"'},
    {open: "'", close: "'"},
    {open: "(*", close: "*)"}
  ],
  // symbols that that can be used to surround a selection
  surroundingPairs: [
    {open: "{", close: "}"},
    {open: "[", close: "]"},
    {open: "(", close: ")"},
    {open: '"', close: '"'},
    {open: "'", close: "'"}
  ]
};

export const language: any = {
  defaultToken: "invalid",
  tokenizer: {
    root: [[/[{}]/, "delimiter.bracket"], {include: "common"}],

    common: [
      // identifiers and keywords
      [
        /[a-z_$][\w$]*/,
        {
          cases: {
            "@keywords": "keyword",
            "@default": "identifier"
          }
        }
      ],
      [/[A-Z][\w\$]*/, "type.identifier"], // to show class names nicely
      [/[A-Z][\w\$]*/, "identifier"],

      // whitespace
      {include: "@whitespace"},

      // delimiters and operators
      [/[()\[\]]/, "@brackets"],
      [/[<>](?!@symbols)/, "@brackets"],
      [/!(?=([^=]|$))/, "delimiter"],
      [
        /@symbols/,
        {
          cases: {
            "@operators": "delimiter",
            "@default": ""
          }
        }
      ],

      // numbers
      [/(@digits)[eE]([\-+]?(@digits))?/, "number.float"],
      [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, "number.float"],
      [/0[xX](@hexdigits)n?/, "number.hex"],
      [/0[oO]?(@octaldigits)n?/, "number.octal"],
      [/0[bB](@binarydigits)n?/, "number.binary"],
      [/(@digits)n?/, "number"],

      // delimiter: after number because of .\d floats
      [/[;,.]/, "delimiter"],

      // strings
      [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
      [/'([^'\\]|\\.)*$/, "string.invalid"], // non-teminated string
      [/"/, "string", "@string_double"],
      [/'/, "string", "@string_single"],
      [/`/, "string", "@string_backtick"]
    ],

    whitespace: [[/[ \t\r\n]+/, ""], [/\/\*/, "comment", "@comment"], [/\/\/.*$/, "comment"]],

    comment: [[/[^\/*]+/, "comment"], [/\*\//, "comment", "@pop"], [/[\/*]/, "comment"]],

    string_double: [
      [/[^\\"]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/"/, "string", "@pop"]
    ],

    string_single: [
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/'/, "string", "@pop"]
    ],

    string_backtick: [
      [/\$\{/, {token: "delimiter.bracket", next: "@bracketCounting"}],
      [/[^\\`$]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/`/, "string", "@pop"]
    ],

    bracketCounting: [
      [/\{/, "delimiter.bracket", "@bracketCounting"],
      [/\}/, "delimiter.bracket", "@pop"],
      {include: "common"}
    ]
  },
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  digits: /\d+(_+\d+)*/,
  octaldigits: /[0-7]+(_+[0-7]+)*/,
  binarydigits: /[0-1]+(_+[0-1]+)*/,
  hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,
  keywords: [],
  operators: [
    "<",
    "<=",
    ">=",
    ">",
    "==",
    "!=",
    "in",

    //
    "&&",
    "||",

    //
    "%",
    "*",
    "/",

    //
    "!",
    "-"
  ]
};
