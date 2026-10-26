export const MINIMUM_SERVER_VERSION_NUM = 180000;

export function assertSupportedServerVersion(serverVersionNum: string | number) {
  const version = Number(serverVersionNum);
  if (!Number.isInteger(version) || version < MINIMUM_SERVER_VERSION_NUM) {
    throw new Error(
      `PostgreSQL 18 or newer is required, but the server reports server_version_num ${serverVersionNum}.`
    );
  }
}
