import axios from "axios";

import {IdentityOptions} from "@spica-server/passport/identity";

export const PASSPORT_OPTIONS = Symbol.for("PASSPORT_OPTIONS");

export interface PassportOptions extends IdentityOptions {
  publicUrl: string;
  defaultStrategy?: string;
  samlCertificateTTL: number;
}

export function requestFactory(options: any) {
  return new Promise((resolve, reject) => {
    axios(options)
      .then(res => resolve(res.data))
      .catch(error =>
        reject(
          error.response
            ? typeof error.response.data == "object"
              ? JSON.stringify(error.response.data)
              : error.response.data || error.response.statusText
            : error.toString()
        )
      );
  });
}

export const REQUEST_SERVICE = Symbol.for("REQUEST_SERVICE");
