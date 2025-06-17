import {bold, green, red} from "colorette";

export function projectName(input: string): string {
  if (input && !input.match(/^[a-z][a-z0-9]+(?:-[a-z0-9]+)*$/)) {
    throw new Error(
      `${red(input)} is an invalid project name.\n` +
        `It should be in format like ${bold("infra1")}, ${bold("infra-1")} or ${bold("project-1")}`
    );
  }

  return input;
}

export const availableSyncModules = [
  "bucket",
  "function",
  "bucket-data",
  "apikey",
  "policy",
  "env-var"
];
export function validateSyncModules(input: string): string {
  const moduleNames = input.split(",").map(m => m.trim());

  if (!moduleNames.length) {
    throw new Error(`You should select one or more of these modules:
${availableSyncModules.map(m => `- ${green(m)}`).join("\n")}`);
  }

  const nonMigratables = moduleNames.filter(module => availableSyncModules.indexOf(module) == -1);
  if (nonMigratables.length) {
    throw new Error(`Some of selected modules are not valid:
${nonMigratables.map(m => `- ${red(m)}`).join("\n")}

Synchronizable modules are:
${availableSyncModules.map(m => `- ${green(m)}`).join("\n")}
    `);
  }

  return input;
}

export function validateSyncIds(input: any): string {
  if (typeof input !== "string") {
    throw new Error("You should provide a comma separated string");
  }
  return input;
}

export const availableHttpServices = ["axios"];

export function separateToNewLines(iterable: any[], colorCtor?: (input) => any) {
  return iterable.map(i => `- ${colorCtor ? colorCtor(i) : i}`).join("\n");
}
