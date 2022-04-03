import {VersionManager, WORKING_DIR} from "./interface";
import {Injectable} from "@nestjs/common";
import simpleGit, {SimpleGit} from "simple-git";

@Injectable()
export class Git implements VersionManager {
  private git: SimpleGit;

  //@TODO: try to get rid of this
  private maps: {name: string; call: Function}[] = [
    {name: "commit", call: (ops?) => this.commit(ops)},
    {name: "checkout", call: (ops?) => this.checkout(ops)},
    {name: "reset", call: (ops?) => this.reset(ops)}
  ];

  run(action: string, options: any): Promise<any> {
    const {call} = this.maps.find(fn => fn.name == action);
    if (!call || typeof call != "function") {
      return Promise.reject(`Unknown action ${action}`);
    }

    return call(options);
  }

  constructor(private cwd: string) {
    this.git = simpleGit({baseDir: this.cwd, binary: "git", maxConcurrentProcesses: 6});
    this.git.init();
  }

  async checkout({branch}): Promise<string> {
    const branches = await this.git.branchLocal();

    const command = [branch];
    if (!branches.all.includes(branch)) {
      command.unshift("-b");
    }

    return this.git.checkout(command);
  }

  async commit({files, message}) {
    await this.git.add(files);
    return this.git.commit(message, files);
  }

  reset({files}): Promise<string> {
    files = Array.isArray(files) ? files : [files];
    return this.git.checkout(["--", ...files]);
  }

  addUpstream({address}) {
    throw new Error("Method not implemented.");
  }
  clone({address}) {
    throw new Error("Method not implemented.");
  }
  pull({branch}) {
    throw new Error("Method not implemented.");
  }
  push({branch}) {
    throw new Error("Method not implemented.");
  }
}
