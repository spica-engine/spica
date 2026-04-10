export type RateLimitValue = number | "";
export type RateLimitItem = {limit: RateLimitValue; ttl: RateLimitValue};
export type ProviderItem = {provider: string; strategy: string};
export type ProviderItemWithId = ProviderItem & {_id: string};

export const PROVIDER_OPTIONS = [
  {label: "email", value: "email"},
  {label: "phone", value: "phone"}
];

export const STRATEGY_OPTIONS = [
  {label: "Otp", value: "Otp"},
  {label: "MagicLink", value: "MagicLink"}
];

let _nextId = 0;
export function genId(): string {
  return `_pid_${_nextId++}`;
}

export function withIds(items: ProviderItem[]): ProviderItemWithId[] {
  return items.map(item => ({...item, _id: genId()}));
}

export function stripIds(items: ProviderItemWithId[]): ProviderItem[] {
  return items.map(({_id, ...rest}) => rest);
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split(".");
  const result = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

export function prepareOptions(options: Record<string, unknown>): Record<string, unknown> {
  const opts = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;
  if (Array.isArray(opts.providerVerificationConfig)) {
    opts.providerVerificationConfig = withIds(opts.providerVerificationConfig as ProviderItem[]);
  }
  if (Array.isArray(opts.resetPasswordProvider)) {
    opts.resetPasswordProvider = withIds(opts.resetPasswordProvider as ProviderItem[]);
  }
  const pl = opts.passwordlessLogin as {passwordlessLoginProvider?: ProviderItem[]} | undefined;
  if (pl && Array.isArray(pl.passwordlessLoginProvider)) {
    opts.passwordlessLogin = {...pl, passwordlessLoginProvider: withIds(pl.passwordlessLoginProvider)};
  }
  return opts;
}

/**
 * Returns sanitized options ready for API save, or null if validation fails
 * (e.g. partial rate limit pair where only one of limit/ttl is provided).
 */
export function sanitizeForSave(options: Record<string, unknown>): Record<string, unknown> | null {
  const result = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;

  if (Array.isArray(result.providerVerificationConfig)) {
    result.providerVerificationConfig = stripIds(
      result.providerVerificationConfig as ProviderItemWithId[]
    );
  }
  if (Array.isArray(result.resetPasswordProvider)) {
    result.resetPasswordProvider = stripIds(
      result.resetPasswordProvider as ProviderItemWithId[]
    );
  }
  const pl = result.passwordlessLogin as {
    passwordlessLoginProvider?: ProviderItemWithId[];
  } | undefined;
  if (pl && Array.isArray(pl.passwordlessLoginProvider)) {
    result.passwordlessLogin = {
      ...pl,
      passwordlessLoginProvider: stripIds(pl.passwordlessLoginProvider)
    };
  }

  if (result.rateLimits && typeof result.rateLimits === "object") {
    const rawRl = result.rateLimits as Record<string, {limit: RateLimitValue; ttl: RateLimitValue}>;
    const cleanRl: Record<string, {limit: number; ttl: number}> = {};
    for (const [cat, rl] of Object.entries(rawRl)) {
      const limitEmpty = rl.limit === "" || rl.limit === 0;
      const ttlEmpty = rl.ttl === "" || rl.ttl === 0;
      if (limitEmpty && ttlEmpty) continue;
      // Reject partial pairs: both limit and ttl must be provided together
      if (limitEmpty !== ttlEmpty) return null;
      cleanRl[cat] = {limit: rl.limit as number, ttl: rl.ttl as number};
    }
    if (Object.keys(cleanRl).length === 0) {
      delete result.rateLimits;
    } else {
      result.rateLimits = cleanRl;
    }
  }

  return result;
}