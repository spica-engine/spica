import {hooks} from "@spica-server/bucket/hooks/proto";

export function getReviewType(type: hooks.Review.Type) {
  switch (type) {
    case hooks.Review.Type.INSERT:
      return "insert";
    case hooks.Review.Type.UPDATE:
      return "update";
    case hooks.Review.Type.DELETE:
      return "delete";
    case hooks.Review.Type.INDEX:
      return "index";
    case hooks.Review.Type.GET:
      return "get";
    case hooks.Review.Type.STREAM:
      return "stream";
    default:
      throw new Error(`Invalid type received. ${hooks.Review.Type[type]}`);
  }
}

export class Review {
  bucket: string;
  documentKey: string;
  headers: Map<string, string>;
  type: string;

  get document() {
    process.emitWarning(
      "document is deprecated and will be removed soon. use documentKey instead.",
      "Deprecated"
    );
    return this.documentKey;
  }

  constructor(review: hooks.Review) {
    this.bucket = review.bucket;
    this.documentKey = review.documentKey;
    this.type = getReviewType(review.type);
    const headers = new Map();
    for (const header of review.headers) {
      headers.set(header.key, header.value);
    }
    this.headers = new Proxy(headers, {
      get: (target, p) => {
        if (p in target) {
          const value = target[p];
          if (typeof value == "function") {
            return value.bind(headers);
          }
          return value;
        }

        p = String(p);

        process.emitWarning(
          `Accessing to headers with property access {  headers['${p}'] OR headers.${p} } is deprecated and will be removed soon.\n` +
            `Consider using { headers.get('${p}') }  instead.`,
          "Deprecated"
        );
        return target.get(p);
      }
    });
  }
}
