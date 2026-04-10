export type FieldMeta = {
  label: string;
  description: string;
  unit?: string;
};

export type ConfigModuleSchema = {
  schema: object;
  fieldMeta: Record<string, FieldMeta>;
};

export const configSchemas: Record<string, ConfigModuleSchema> = {
  user: {
    schema: {
      type: "object",
      properties: {
        verificationProcessMaxAttempt: {type: "integer"},
        passwordlessLogin: {
          type: "object",
          properties: {
            passwordlessLoginProvider: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  provider: {type: "string", enum: ["email", "phone"]},
                  strategy: {type: "string"}
                }
              }
            }
          }
        },
        resetPasswordProvider: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider: {type: "string", enum: ["email", "phone"]},
              strategy: {type: "string"}
            }
          }
        },
        providerVerificationConfig: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider: {type: "string", enum: ["email", "phone"]},
              strategy: {type: "string", enum: ["Otp", "MagicLink"]}
            }
          }
        },
        rateLimits: {
          type: "object",
          properties: {
            login: {
              type: "object",
              properties: {
                limit: {type: "integer", minimum: 1},
                ttl: {type: "integer", minimum: 1}
              },
              required: ["limit", "ttl"]
            },
            providerVerification: {
              type: "object",
              properties: {
                limit: {type: "integer", minimum: 1},
                ttl: {type: "integer", minimum: 1}
              },
              required: ["limit", "ttl"]
            },
            forgotPassword: {
              type: "object",
              properties: {
                limit: {type: "integer", minimum: 1},
                ttl: {type: "integer", minimum: 1}
              },
              required: ["limit", "ttl"]
            },
            refreshToken: {
              type: "object",
              properties: {
                limit: {type: "integer", minimum: 1},
                ttl: {type: "integer", minimum: 1}
              },
              required: ["limit", "ttl"]
            },
            createUser: {
              type: "object",
              properties: {
                limit: {type: "integer", minimum: 1},
                ttl: {type: "integer", minimum: 1}
              },
              required: ["limit", "ttl"]
            }
          }
        }
      }
    },
    fieldMeta: {
      "verificationProcessMaxAttempt": {
        label: "Verification max attempts",
        description: "Maximum number of verification attempts allowed per session",
        unit: "attempts"
      },
      "rateLimits.login.limit": {
        label: "Rate limit for sign-ups and sign-ins",
        description:
          "Number of sign-up and sign-in requests that can be made in a 5 minute interval per IP address (excludes anonymous users)",
        unit: "requests/5 min"
      },
      "rateLimits.login.ttl": {
        label: "Sign-up/sign-in TTL",
        description: "Time window in seconds for sign-up and sign-in rate limiting",
        unit: "seconds"
      },
      "rateLimits.providerVerification.limit": {
        label: "Rate limit for token verifications",
        description:
          "Number of OTP/Magic link verifications that can be made in a 5 minute interval per IP address",
        unit: "requests/5 min"
      },
      "rateLimits.providerVerification.ttl": {
        label: "Token verification TTL",
        description: "Time window in seconds for token verification rate limiting",
        unit: "seconds"
      },
      "rateLimits.forgotPassword.limit": {
        label: "Rate limit for sending emails",
        description: "Number of emails that can be sent per hour from your project",
        unit: "emails/h"
      },
      "rateLimits.forgotPassword.ttl": {
        label: "Forgot password TTL",
        description: "Time window in seconds for forgot password rate limiting",
        unit: "seconds"
      },
      "rateLimits.refreshToken.limit": {
        label: "Rate limit for token refreshes",
        description:
          "Number of sessions that can be refreshed in a 5 minute interval per IP address",
        unit: "requests/5 min"
      },
      "rateLimits.refreshToken.ttl": {
        label: "Token refresh TTL",
        description: "Time window in seconds for token refresh rate limiting",
        unit: "seconds"
      },
      "rateLimits.createUser.limit": {
        label: "Rate limit for anonymous users",
        description:
          "Number of anonymous sign-ins that can be made per hour per IP address",
        unit: "requests/h"
      },
      "rateLimits.createUser.ttl": {
        label: "Anonymous user TTL",
        description: "Time window in seconds for anonymous user rate limiting",
        unit: "seconds"
      },
      "passwordlessLogin.passwordlessLoginProvider": {
        label: "Passwordless login providers",
        description: "Configure providers and strategies for passwordless login"
      },
      "resetPasswordProvider": {
        label: "Reset password providers",
        description: "Configure providers and strategies for password reset"
      },
      "providerVerificationConfig": {
        label: "Provider verification config",
        description: "Configure providers and strategies for user verification"
      }
    }
  },
  versioncontrol: {
    schema: {
      type: "object",
      properties: {
        autoApproveSync: {
          type: "object",
          properties: {
            document: {type: "boolean"},
            representative: {type: "boolean"}
          }
        }
      }
    },
    fieldMeta: {
      "autoApproveSync.document": {
        label: "Auto approve document sync",
        description: "Automatically approve document synchronization changes"
      },
      "autoApproveSync.representative": {
        label: "Auto approve representative sync",
        description: "Automatically approve representative synchronization changes"
      }
    }
  }
};
