import {VersionManager, WORKING_DIR} from "./interface";
import * as child_process from "child_process";
import {Inject} from "@nestjs/common";

export class Git implements VersionManager {
  constructor(@Inject(WORKING_DIR) private cwd: string) {}

  private run = (cmd: string) => {
    child_process.exec(cmd, {cwd: this.cwd});
  };

  createBranch(name: string) {
    this.run(`git branch ${name}`);
  }

  switchBranch(name: string) {
    this.run(`git checkout ${name}`);
  }

  add(files: string[]) {
    this.run(`git add ${files.join(",")}`);
  }

  commit(message: string) {
    this.run(`git commit -m '${message}'`);
  }

  // these commands might be handled with upstream manager
  addUpstream(address: string) {
    throw new Error("Method not implemented.");
  }

  clone(address: string) {
    throw new Error("Method not implemented.");
  }

  pull(branch: string) {
    throw new Error("Method not implemented.");
  }

  push(branch: string) {
    throw new Error("Method not implemented.");
  }
}
