import { IdentityOptions } from "@spica-server/passport/identity";

export const PASSPORT_OPTIONS = Symbol.for("PASSPORT_OPTIONS");

export interface PassportOptions extends IdentityOptions {
  publicUrl: string;
  defaultStrategy?: string;
  samlCertificateTTL: number;
}
