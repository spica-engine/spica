import chalk from "chalk";

export function namespace(input: string) {
  if (input && !input.match(/^[a-z][a-z0-9]+(?:-[a-z0-9]+)*$/)) {
    return `${chalk.green(input)} is an invalid namespace. It should be in format like ${chalk.bold(
      "infra1"
    )}, ${chalk.bold("infra-1")} or ${chalk.bold("my-spica-1")}`;
  }
  return true;
}
