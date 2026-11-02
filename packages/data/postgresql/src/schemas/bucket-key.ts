import {Keyword} from "@spica-server/interface-core";

const KEY_TYPES = ["uuid", "integer", "bigint", "string"];

type Properties = Record<
  string,
  {type?: string; options?: Record<string, unknown>; [key: string]: any}
>;

function generatedPaths(properties: Properties | undefined, prefix: string[]): string[] {
  return Object.entries(properties ?? {}).flatMap(([name, property]) => {
    const path = [...prefix, name];
    const nested = property.properties ?? property.items?.properties;
    return [
      ...(property.options?.generated ? [path.join(".")] : []),
      ...generatedPaths(nested, path)
    ];
  });
}

export function keyProblems(bucket: {primary?: string; properties?: Properties}): string[] {
  const properties = bucket.properties ?? {};
  const key = bucket.primary ? properties[bucket.primary] : undefined;

  const problems: string[] = [];
  if (!key) {
    problems.push(`primary must name a property, but "${bucket.primary}" is not one`);
  } else {
    if (!KEY_TYPES.includes(key.type as string)) {
      problems.push(
        `the primary property "${bucket.primary}" must be one of ${KEY_TYPES.join(", ")}, not ${key.type}`
      );
    }
    if (key.options?.translate) {
      problems.push(`the primary property "${bucket.primary}" cannot be translated`);
    }
  }

  for (const path of generatedPaths(properties, [])) {
    if (path !== bucket.primary) {
      problems.push(`"${path}" cannot be generated, only the primary property can be`);
    }
  }
  return problems;
}

export const bucketKeyKeyword: Keyword = {
  keyword: "bucketKey",
  type: "object",
  schemaType: "boolean",
  errors: true,
  validate: function validate(schema: boolean, data: any) {
    if (!schema) {
      return true;
    }
    const problems = keyProblems(data);
    (validate as any).errors = problems.map(message => ({
      keyword: "bucketKey",
      message,
      params: {}
    }));
    return problems.length == 0;
  }
};
