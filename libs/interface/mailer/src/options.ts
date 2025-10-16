export interface MailerOptions {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  defaults?: {
    from?: string;
  };
}

export const MAILER_OPTIONS = "MAILER_OPTIONS";
