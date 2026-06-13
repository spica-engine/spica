import {bold, yellow} from "colorette";
import {ResourceModule} from "@spica-server/sync";
import {secretModule} from "@spica-server/sync";

type SecretSchema = {
  key?: string;
  value?: unknown;
};

export async function findLocalSecretsWithValues(
  modules: ResourceModule[],
  rootDir: string
): Promise<string[]> {
  if (!modules.some(mod => mod.name === secretModule.name)) {
    return [];
  }

  const locals = await secretModule.readLocal(rootDir);

  return locals
    .filter(local => {
      const secret = local.data as SecretSchema;
      return typeof secret.value === "string" && secret.value.length > 0;
    })
    .map(local => {
      const secret = local.data as SecretSchema;
      return secret.key || local.slug;
    })
    .sort((a, b) => a.localeCompare(b));
}

export function renderSecretValueWarnings(secretNames: string[]): void {
  for (const secretName of secretNames) {
    console.log(
      yellow(
        `  Warning: secret(${secretName}) includes value in the local files. ` +
          `It is not suggested to version secret values, omit value on local file ` +
          `or consider using environment variables.`
      )
    );
  }

  if (secretNames.length > 0) {
    console.log(
      yellow(
        `  ${bold("Proceeding will still send local secret values to the remote API for changed secrets.")}`
      )
    );
  }
}

