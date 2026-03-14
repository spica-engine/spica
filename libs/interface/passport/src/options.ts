import {IdentityOptions} from "@spica-server/interface/passport/identity";
import {UserOptions} from "@spica-server/interface/passport/user";

export interface PassportOptions {
  publicUrl: string;
  defaultStrategy?: string;
  samlCertificateTTL: number;
  apikeyRealtime: boolean;
  refreshTokenRealtime: boolean;
  policyRealtime: boolean;
  identityOptions: IdentityOptions;
  userOptions: UserOptions;
}

export const PASSPORT_OPTIONS = Symbol.for("PASSPORT_OPTIONS");
export const STRATEGIES = Symbol.for("STRATEGIES");

export const REQUEST_SERVICE = Symbol.for("REQUEST_SERVICE");
