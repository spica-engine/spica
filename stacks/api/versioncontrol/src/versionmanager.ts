import {VersionManager} from "./interface";
import {Injectable} from "@nestjs/common";
import simpleGit, {SimpleGit} from "simple-git";

@Injectable()
export class Git implements VersionManager {
  private git: SimpleGit;

  //@TODO: try to get rid of this
  private map(action: string, options: any) {
    return () => this[action](options);
  }
  private maps: {name: string; call: Function}[] = [
    {name: "reset", call: ops => this.reset(ops)},
    {name: "add", call: ops => this.add(ops)},
    {name: "commit", call: ops => this.commit(ops)},

    {name: "checkout", call: ops => this.checkout(ops)},
    {name: "branch", call: ops => this.branch(ops)},

    {name: "fetch", call: ops => this.fetch(ops)},
    {name: "pull", call: ops => this.pull(ops)},
    {name: "push", call: ops => this.push(ops)},
    {name: "merge", call: ops => this.merge(ops)},

    {name: "remote", call: ops => this.remote(ops)},

    {name: "diff", call: ops => this.diff(ops)},
    {name: "log", call: ops => this.log(ops)}
  ];

  run(action: string, options: any): Promise<any> {
    const map = this.maps.find(fn => fn.name == action);
    if (!map) {
      return Promise.reject(`Unknown action ${action}`);
    }

    return map.call(options);
  }

  constructor(private cwd: string) {
    this.git = simpleGit({baseDir: this.cwd, binary: "git", maxConcurrentProcesses: 6});
    this.git.init();
  }

  checkout({args}) {
    return this.git.checkout(args);
  }

  branch({args}) {
    return this.git.branch(args);
  }

  add({files}) {
    return this.git.add(files);
  }

  commit({message}) {
    return this.git.commit(message);
  }

  merge({args}) {
    return this.git.merge(args);
  }

  reset({args}) {
    return this.git.reset(args);
  }

  remote({args}) {
    return this.git.remote(args);
  }

  fetch({args}) {
    return this.git.fetch(args);
  }

  log({args}) {
    return this.git.log(args);
  }

  push({args}) {
    return this.git.push(args);
  }

  diff({args}) {
    return this.git.diff(args);
  }

  pull({args}) {
    return this.git.pull(args);
  }
}
