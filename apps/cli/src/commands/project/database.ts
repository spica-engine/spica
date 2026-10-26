export type DatabaseType = "mongodb" | "postgresql";

export const DATABASE_TYPES: DatabaseType[] = ["mongodb", "postgresql"];

export const POSTGRES_USERNAME = "spica";
export const POSTGRES_PASSWORD = "spica";

export function databaseImage(type: DatabaseType, versions: {mongo: string; postgres: string}) {
  return type == "postgresql"
    ? {image: "postgres", tag: versions.postgres}
    : {image: "mongo", tag: versions.mongo};
}

export function isDatabaseImage(image: string) {
  return image.startsWith("mongo") || image.startsWith("postgres");
}

export function databaseApiArgs(type: DatabaseType, name: string, databaseName: string) {
  if (type == "postgresql") {
    return [
      "--database-type=postgresql",
      `--database-uri=postgres://${POSTGRES_USERNAME}:${POSTGRES_PASSWORD}@${databaseName}-0:5432/${name}`
    ];
  }
  return [
    `--database-name=${name}`,
    `--database-replica-set=${name}`,
    `--database-uri="mongodb://${databaseName}-0,${databaseName}-1,${databaseName}-2"`
  ];
}

export function postgresContainerEnv(name: string) {
  return [
    `POSTGRES_USER=${POSTGRES_USERNAME}`,
    `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
    `POSTGRES_DB=${name}`
  ];
}
