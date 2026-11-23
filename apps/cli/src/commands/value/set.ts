import path from "node:path";
import {ActionParameters, Command, Program} from "@caporal/core";
import {listFolders, sanitizeSlug} from "@spica-server/sync";
import {config} from "../../config";
import {upsertEntry, valuesFilePath} from "../../value-store";
import {readSecret} from "../sync/prompt";

export interface ValueKind {
  command: string;
  moduleName: string;
  description: string;
}

export const ENV: ValueKind = {
  command: "env",
  moduleName: "env-var",
  description: "Set the value of a declared environment variable for the current context."
};

export const SECRET: ValueKind = {
  command: "secret",
  moduleName: "secret",
  description: "Set the value of a declared secret for the current context."
};

export function saveValue(
  kind: ValueKind,
  {
    rootDir,
    contextName,
    key,
    value
  }: {rootDir: string; contextName: string; key: string; value: string}
): string {
  const declared = listFolders(path.join(rootDir, kind.moduleName));
  if (!declared.includes(sanitizeSlug(key))) {
    throw new Error(
      `"${key}" is not declared. Create ${kind.moduleName}/${key}/schema.yaml first.`
    );
  }

  const filePath = valuesFilePath(rootDir, contextName);
  upsertEntry(filePath, key, value);
  return filePath;
}

function action(kind: ValueKind) {
  return async ({args}: ActionParameters) => {
    try {
      const key = args.key as string;
      const value = (args.value as string | undefined) ?? (await readSecret(`${key}: `));
      const {context} = await config.get();
      const filePath = saveValue(kind, {rootDir: process.cwd(), contextName: context, key, value});
      console.info(`Saved ${key} to ${path.relative(process.cwd(), filePath)}.`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  };
}

export function envSet(program: Program): Command {
  return program
    .command(ENV.command, ENV.description)
    .argument("<key>", "Key of the environment variable.")
    .argument("<value>", "Value of the environment variable.")
    .action(action(ENV));
}

export function secretSet(program: Program): Command {
  return program
    .command(SECRET.command, SECRET.description)
    .argument("<key>", "Key of the secret.")
    .action(action(SECRET));
}
