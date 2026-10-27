import {defineEntity} from "@spica-server/data-postgresql-orm";
import {ApiKey} from "@spica-server/interface-passport-apikey";
import {Identity} from "@spica-server/interface-passport-identity";
import {Policy} from "@spica-server/interface-passport-policy";
import {RefreshToken} from "@spica-server/interface-passport-refresh_token";
import {Id} from "@spica-server/interface-data";
import {Strategy} from "@spica-server/interface-passport";
import {User, UserVerification} from "@spica-server/interface-passport-user";

export type StoredVerification = UserVerification & {_id?: Id; provider?: string};

const credentials = {
  password: {type: "text"},
  deactivateJwtsBefore: {type: "double precision"},
  policies: {type: "text[]", notNull: true, default: []},
  authFactor: {type: "jsonb"},
  lastPasswords: {type: "text[]", notNull: true, default: []},
  lastLogin: {type: "timestamptz", keepNull: true},
  failedAttempts: {type: "timestamptz[]", notNull: true, default: []}
} as const;

export const identities = defineEntity<Identity>({
  table: "identities",
  idProperty: "_id",
  columns: {
    identifier: {type: "text", notNull: true},
    ...credentials
  },
  indexes: [
    {columns: ["identifier"], unique: true},
    {columns: ["policies"], using: "gin"}
  ]
});

export const users = defineEntity<User>({
  table: "users",
  idProperty: "_id",
  columns: {
    username: {type: "text", notNull: true},
    ...credentials,
    bannedUntil: {type: "timestamptz"},
    email: {type: "jsonb"},
    email_verified_at: {type: "timestamptz"},
    phone: {type: "jsonb"},
    phone_verified_at: {type: "timestamptz"},
    attributes: {type: "jsonb"},
    signUpStrategy: {type: "jsonb"}
  },
  indexes: [
    {columns: ["username"], unique: true},
    {columns: ["policies"], using: "gin"},
    {
      name: "users_email_hash_key",
      keys: ["email.hash"],
      expression: "(email->>'hash')",
      unique: true,
      where: "(email->>'hash') IS NOT NULL"
    },
    {
      name: "users_phone_hash_key",
      keys: ["phone.hash"],
      expression: "(phone->>'hash')",
      unique: true,
      where: "(phone->>'hash') IS NOT NULL"
    }
  ]
});

export const verifications = defineEntity<StoredVerification>({
  table: "verifications",
  idProperty: "_id",
  columns: {
    userId: {type: "uuid", notNull: true},
    destination: {type: "text"},
    attempts: {type: "integer"},
    code: {type: "text"},
    strategy: {type: "text", notNull: true},
    purpose: {type: "text", notNull: true},
    provider: {type: "text"},
    is_used: {type: "boolean", notNull: true, default: false},
    requestCount: {type: "integer"},
    createdAt: {type: "timestamptz", notNull: true, default: "now()"}
  },
  indexes: [
    {
      name: "verifications_pending_key",
      columns: ["userId", "strategy", "purpose"],
      unique: true,
      where: "NOT is_used"
    }
  ]
});

export const policies = defineEntity<Policy>({
  table: "policies",
  idProperty: "_id",
  columns: {
    name: {type: "text", notNull: true},
    description: {type: "text"},
    statement: {type: "jsonb", notNull: true, default: []}
  }
});

export const apiKeys = defineEntity<ApiKey>({
  table: "apikeys",
  idProperty: "_id",
  columns: {
    key: {type: "text"},
    name: {type: "text", notNull: true},
    description: {type: "text"},
    policies: {type: "text[]", notNull: true, default: []},
    active: {type: "boolean", notNull: true, default: true}
  },
  indexes: [
    {columns: ["key"], unique: true},
    {columns: ["policies"], using: "gin"}
  ]
});

export const refreshTokens = defineEntity<RefreshToken>({
  table: "refresh_tokens",
  idProperty: "_id",
  columns: {
    identity: {type: "text", column: "identity_id"},
    user: {type: "text", column: "user_id"},
    token: {type: "text", notNull: true},
    created_at: {type: "timestamptz"},
    expired_at: {type: "timestamptz"},
    last_used_at: {type: "timestamptz"},
    disabled: {type: "boolean"}
  },
  indexes: [{columns: ["token"], unique: true}, {columns: ["expired_at"]}]
});

export const strategies = defineEntity<Strategy>({
  table: "strategies",
  idProperty: "_id",
  columns: {
    type: {type: "text", notNull: true},
    name: {type: "text"},
    title: {type: "text"},
    icon: {type: "text"},
    options: {type: "jsonb"}
  }
});
