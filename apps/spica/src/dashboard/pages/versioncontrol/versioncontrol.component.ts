import {Component} from "@angular/core";
import {VersionControlService} from "@spica-client/dashboard/services/versioncontrol.service";
import {tap} from "rxjs/operators";

@Component({
  selector: "versioncontrol",
  templateUrl: "./versioncontrol.component.html",
  styleUrls: ["./versioncontrol.component.scss"]
})
export class VersionControlComponent {
  command = "";
  response = this.prettfyJson({});

  isPending = false;

  availableCommands: string[] = [];

  constructor(private vcs: VersionControlService) {
    vcs
      .getCommands()
      .toPromise()
      .then(commands => (this.availableCommands = commands));
  }

  execute() {
    const {action, args} = this.separateCommand();

    this.isPending = true;
    return this.vcs
      .exec(action, args)
      .pipe(tap(res => (this.response = this.prettfyJson(res))))
      .toPromise()
      .finally(() => (this.isPending = false));
  }

  separateCommand() {
    const regex = /(?:[^\s"']+|['"][^'"]*["'])+/g;
    const words = this.command.match(regex);

    const action = words[0];
    const args = words.slice(1);
    return {action, args};
  }

  prettfyJson(obj) {
    return JSON.stringify(obj, null, 4);
  }

  onCommandChange(cmd) {
    if (cmd && cmd.trim().startsWith("git")) {
      this.command = cmd = cmd.replace("git", "");
    }
  }
}
