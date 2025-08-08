import {BucketDocument} from "../../../../../../libs/interface/bucket";
import {JSONSchema7, JSONSchema7TypeName} from "json-schema";

export namespace Path {
  export function set(
    document: BucketDocument,
    paths: Array<string | number>,
    value: string | number | boolean
  ): void {
    for (let i = 0; i < paths.length - 1; i++) {
      const path = paths[i];
      const currObject = document[paths[i]];

      const nextPath = paths[i + 1];

      if (typeof nextPath == "number" && !Array.isArray(currObject)) {
        document = document[path] = [];
      } else if (
        typeof path == "string" &&
        typeof nextPath != "number" &&
        (typeof currObject != "object" || Array.isArray(currObject) || currObject == null)
      ) {
        document = document[path] = {};
      } else {
        document = document[path];
      }
    }

    const property = paths[paths.length - 1];

    document[property] = value;
  }

  export function unset(document: BucketDocument, paths: Array<string | number>) {
    for (let i = 0; i < paths.length - 1; i++) {
      document = document[paths[i]];
    }

    const lastPath = paths[paths.length - 1];
    if (Array.isArray(document) && typeof lastPath == "number") {
      document.splice(lastPath, 1);
    } else {
      delete document[lastPath];
    }
  }

  export function get(path: Array<string | number>, document: BucketDocument): any {
    return path.reduce((prev, curr) => {
      return prev ? prev[curr] : null;
    }, document);
  }

  export function type(
    paths: Array<string | number>,
    schema: JSONSchema7
  ): JSONSchema7TypeName | undefined {
    for (const path of paths) {
      if (typeof path == "string") {
        schema = schema && (schema.properties[path] as JSONSchema7);
      } else {
        schema = schema && (schema.items as JSONSchema7);
      }
    }
    return (schema && schema.type) as JSONSchema7TypeName | undefined;
  }
}
