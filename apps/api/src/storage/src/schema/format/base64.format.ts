import {Format} from "@spica-server/core/schema";

export const BASE_64: Format = {
  name: "base64",
  type: "string",
  coerce: (value: string) => {
    return Buffer.from(value, "base64");
  },
  validate: (value: string) => {
    return /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(value);
  }
};
