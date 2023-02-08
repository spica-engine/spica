import {Command, CommandWithId} from "@spica-server/interface/asset";

export abstract class Commander {
  private completedCommands: CommandWithId[] = [];
  private commands: CommandWithId[] = [];

  constructor(private _commands: Command[]) {
    this.commands = this._commands.map((cmd, i) => {
      return {...cmd, id: i};
    });
  }

  pushCommand(command: Command) {
    this.commands.push({...command, id: this.commands.length});
  }

  async run() {
    for (let command of this.commands.reverse()) {
      try {
        await command.execute();
        this.completedCommands.push(command);
      } catch (error) {
        const undoCommands = this.completedCommands.concat([command]);
        console.error(
          `Executing command id '${command.id}' name '${
            command.title
          }' has been failed. Undoing '${undoCommands.map(cmd => cmd.title).join(",")}'`
        );
        Promise.all(undoCommands.map(c => c.undo()));

        return Promise.reject(error);
      }
    }
  }
}

export class AssetCommander extends Commander {}
