const macros = [
  {
    label: "has",
    detail: "(method) has(fieldPath: unknown): boolean",
    description: {
      value: `Returns true if **fieldPath** exists\n
*@param* **fieldPath** - The path that will be checked the existence on the document or auth.`
    },
    text: "has(document$0)"
  },
  {
    label: "now",
    detail: "(method) now(): number",
    description: {
      value: `Returns unix timestamp of the request execution.\n`
    },
    text: "now()"
  },
  {
    label: "unixTime",
    detail: "(method) unixTime(fieldPath: unknown): number",
    description: {
      value: `Returns unix timestamp of **fieldPath**\n
*@param* **fieldPath** - The path that represents the actual value on the document or auth. Actual value must be a Date`
    },
    text: "unixTime(document$0)"
  },
  {
    label: "some",
    detail: "(method) some(target: unknown | any[], compare: unknown | any[]): boolean",
    description: {
      value: `Returns true if **target** includes at least one of **compare**\n 
*@param* **target** The array which includes one of **compare** item at least.\n
- unknown: The path that represents the actual value on the document or auth. Actual value must be an array\n
- any[]: any type of array.\n
*@param* **compare** The array which has minimum one item that included by **target**\n 
- unknown: The path that represents the actual value on the document or auth. Actual value must be an array\n
- any[]: any type of array.
`
    },
    text: "some(document$1, [${0:}])"
  },
  {
    label: "every",
    detail: "(method) every(target: unknown | any[], compare: unknown | any[]): boolean",
    description: {
      value: `Returns true if **target** includes all of **compare**\n 
*@param* **target** The array which includes all of **compare** items.\n
- unknown: The path that represents the actual value on the document or auth. Actual value must be an array\n
- any[]: any type of array.\n
*@param* **compare** The array which is all of items included by **target**\n 
- unknown: The path that represents the actual value on the document or auth. Actual value must be an array\n
- any[]: any type of array.
`
    },
    text: "every(document$1, [${0:}])"
  },
  {
    label: "equal",
    detail: "(method) equal(target: unknown | any[], compare: unknown | any[]): boolean",
    description: {
      value: `Returns true if **target** equals to **compare**. Order of items is not necessary.\n 
*@param* **target** The array which equals to **compare**.\n
- unknown: The path that represents the actual value on the document or auth. Actual value must be an array\n
- any[]: any type of array.\n
*@param* **compare** The array which equals to **target**.\n 
- unknown: The path that represents the actual value on the document or auth. Actual value must be an array\n
- any[]: any type of array.
`
    },
    text: "equal(document$1, [${0:}])"
  },
  {
    label: "regex",
    detail: "(method) regex(fieldPath: unknown, regex: string, flags?: string): boolean",
    description: {
      value: `Returns true if **fieldPath** match with **regex**\n
*@param* **fieldPath** - The path that represents the actual value on the document or auth. Actual value must be a string\n
*@param* **regex** - Regular expression that will be compared\n
*@param* **flags** - Regular expression flags
`
    },
    text: "regex(document$1, '${2:regular_expression}', '${3:gm}')"
  },
  {
    label: "length",
    detail: "(method) length(fieldPath: unknown): number",
    description: {
      value: `Returns length of the **fieldPath**.\n
*@param* **fieldPath** - The path that represents the actual value on the document or auth. Actual value must be array.`
    },
    text: "length(document$0)"
  }
];

const fields = [
  {
    label: "document",
    description: "Represents the bucket data. Access fields of bucket data with this keyword",
    text: "document",
    properties: [],
    examples: [
      {
        label: "example1",
        detail: "Basic example for writing expression",
        text: `document.title == '\${0:Hello world}'`
      }
    ]
  },
  {
    label: "auth",
    description: "Represents the request's user. Access fields of user with this keyword.",
    text: "auth",
    properties: [
      {
        label: "_id",
        description: "Identity id, type: string",
        text: "_id"
      },
      {
        label: "identifier",
        description: "Identity identifier, type: string",
        text: "identifier"
      },
      {
        label: "policies",
        description: "Policy ids of the identity, type: string[]",
        text: "policies"
      },
      {
        label: "attributes",
        description: "Identity custom properties",
        text: "attributes"
      }
    ],
    examples: [
      {
        label: "example2",
        detail: "Basic example for writing expression",
        text: `auth.identifier == '\${0:spica}'`
      }
    ]
  }
];

export {fields, macros};
