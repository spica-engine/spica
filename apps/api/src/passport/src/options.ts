import axios from "axios";

import {IdentityOptions} from "@spica-server/passport/identity";

export const PASSPORT_OPTIONS = Symbol.for("PASSPORT_OPTIONS");
export const STRATEGIES = Symbol.for("STRATEGIES");

export interface PassportOptions extends IdentityOptions {
  publicUrl: string;
  defaultStrategy?: string;
  samlCertificateTTL: number;
}

export class RequestService {
  request(options: any) {
    return axios(options)
      .then(res => res.data)
      .catch(error =>
        Promise.reject(
          error.response
            ? typeof error.response.data == "object"
              ? JSON.stringify(error.response.data)
              : error.response.data || error.response.statusText
            : error.toString()
        )
      );
  }
}

export const REQUEST_SERVICE = Symbol.for("REQUEST_SERVICE");
