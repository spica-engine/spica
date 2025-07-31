import {IdentityOptions} from "@spica-server/interface/passport/identity";

export interface PassportOptions extends IdentityOptions {
  publicUrl: string;
  defaultStrategy?: string;
  samlCertificateTTL: number;
  apikeyRealtime: boolean;
  refreshTokenRealtime: boolean;
}

export const PASSPORT_OPTIONS = Symbol.for("PASSPORT_OPTIONS");
export const STRATEGIES = Symbol.for("STRATEGIES");

export const REQUEST_SERVICE = Symbol.for("REQUEST_SERVICE");
