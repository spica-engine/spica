export interface ExpiringRepository {
  applyExpiry(): Promise<void>;
}

export const isExpiring = (repository: unknown): repository is ExpiringRepository =>
  typeof (repository as ExpiringRepository)?.applyExpiry == "function";
