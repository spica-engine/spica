export interface AuthFactorMeta {
  type: string;
  config: Record<string, any>;
  title?: string;
  description?: string;
}

export interface StartFactorVerificationResponse {
  challenge: string;
  answerUrl: string;
}
