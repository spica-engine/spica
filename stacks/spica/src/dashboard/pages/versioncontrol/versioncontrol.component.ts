import {Component} from "@angular/core";
import {VersionControlService} from "@spica-client/dashboard/services/versioncontrol.service";
import {BehaviorSubject, of} from "rxjs";
import {switchMap, tap} from "rxjs/operators";

@Component({
  selector: "versioncontrol",
  templateUrl: "./versioncontrol.component.html",
  styleUrls: ["./versioncontrol.component.scss"]
})
export class VersionControlComponent {
  command = "";
  response = this.prettfyJson({});

  isPending = false;

  constructor(private vcs: VersionControlService) {}

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
}
