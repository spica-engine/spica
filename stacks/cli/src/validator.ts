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

const migratableModules = ["bucket", "function"];
export function validateMigrationModules(input: string): string {
  const moduleNames = input.split(",").map(m => m.trim());

  if (!moduleNames.length) {
    throw new Error(`You should select one or more of these modules:
${migratableModules.map(m => `- ${green(m)}`).join("\n")}`);
  }

  const nonMigratables = moduleNames.filter(module => migratableModules.indexOf(module) == -1);
  if (nonMigratables.length) {
    throw new Error(`Some of selected modules are not valid:
${nonMigratables.map(m => `- ${red(m)}`).join("\n")}

Migratable modules are:
${migratableModules.map(m => `- ${green(m)}`).join("\n")}
    `);
  }

  return input;
}
