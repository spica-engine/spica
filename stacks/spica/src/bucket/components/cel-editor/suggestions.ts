const functions = [
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
    label: "some",
    detail: "(method) some(fieldPath: unknown, ...items: any[]): boolean",
    description: {
      value: `Returns true if **fieldPath** includes at least one of **items**\n 
*@param* **fieldPath** - The path that represents the actual value on the document or auth. Actual value must be an array\n
*@param* **items** - Items that will be compared. Pass them one by one`
    },
    text: "some(document$1, '${0:value1}')"
  },
  {
    label: "every",
    detail: "(method) every(fieldPath: unknown, ...items: any[]): boolean",
    description: {
      value: `Returns true if **fieldPath** includes all of **items**\n
*@param* **fieldPath** - The path that represents the actual value on the document or auth. Actual value must be an array\n
*@param* **items** - Items that will be compared. Pass them one by one`
    },
    text: "every(document$1, '${0:value1}')"
  },
  {
    label: "equal",
    detail: "(method) equal(fieldPath: unknown, ...items: any[]): boolean",
    description: {
      value: `Returns true if **fieldPath** equals to **items**. Order of items is not necessary.\n
*@param* **fieldPath** - The path that represents the actual value on the document or auth. Actual value must be an array\n
*@param* **items** - Items that will be compared. Pass them one by one`
    },
    text: "equal(document$1, '${0:value1}')"
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
  }
];

const auths = [
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
  }
];

const baseFields = [
  {
    label: "document",
    description: "Represents the bucket data. Access fields of bucket data with this keyword",
    text: "document"
  },
  {
    label: "auth",
    description: "Represents the request's user. Access fields of user with this keyword.",
    text: "auth"
  }
];

const examples = [
  {
    label: "example1",
    detail: "Basic example for writing rule",
    text: `document.title == '\${0:Hello world}'`
  },
  {
    label: "example2",
    detail: "Basic example for writing rule",
    text: `auth.identifier == '\${0:spica}'`
  }
];

export {baseFields, auths, functions, examples};