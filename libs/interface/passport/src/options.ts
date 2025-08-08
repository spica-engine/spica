import {IdentityOptions} from "../identity";

export interface PassportOptions extends IdentityOptions {
  publicUrl: string;
  defaultStrategy?: string;
  samlCertificateTTL: number;
  apikeyRealtime: boolean;
  policyRealtime: boolean;
}

export const PASSPORT_OPTIONS = Symbol.for("PASSPORT_OPTIONS");
export const STRATEGIES = Symbol.for("STRATEGIES");

export const REQUEST_SERVICE = Symbol.for("REQUEST_SERVICE");
