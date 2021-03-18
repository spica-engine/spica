import {bold, red} from "colorette";

export function projectName(input: string): string {
  if (input && !input.match(/^[a-z][a-z0-9]+(?:-[a-z0-9]+)*$/)) {
    throw new Error(
      `${red(input)} is an invalid project name.\n` +
        `It should be in format like ${bold("infra1")}, ${bold("infra-1")} or ${bold("project-1")}`
    );
  }

  return input;
}
