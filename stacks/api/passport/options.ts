export const PASSPORT_OPTIONS = Symbol.for("PASSPORT_OPTIONS");

export interface PassportOptions {
  publicUrl: string;
  issuer: string;
  audience?: string;
  secretOrKey: string;
  defaultPassword?: string;
  defaultStrategy?: string;
  samlCertificateTTL: number;
}
