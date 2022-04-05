import {VersionManager} from "./interface";
import {Injectable} from "@nestjs/common";
import simpleGit, {SimpleGit} from "simple-git";

@Injectable()
export class Git implements VersionManager {
  private git: SimpleGit;

  //@TODO: consider removing this map and calling dynamically
  private maps: {cmd: string; exec: Function}[] = [
    {cmd: "reset", exec: ops => this.reset(ops)},
    {cmd: "add", exec: ops => this.add(ops)},
    {cmd: "commit", exec: ops => this.commit(ops)},
    {cmd: "tag", exec: ops => this.tag(ops)},
    {cmd: "stash", exec: ops => this.stash(ops)},

    {cmd: "checkout", exec: ops => this.checkout(ops)},
    {cmd: "branch", exec: ops => this.branch(ops)},

    {cmd: "fetch", exec: ops => this.fetch(ops)},
    {cmd: "pull", exec: ops => this.pull(ops)},
    {cmd: "push", exec: ops => this.push(ops)},
    {cmd: "merge", exec: ops => this.merge(ops)},
    {cmd: "rebase", exec: ops => this.rebase(ops)},

    {cmd: "remote", exec: ops => this.remote(ops)},

    {cmd: "diff", exec: ops => this.diff(ops)},
    {cmd: "log", exec: ops => this.log(ops)}
  ];

  availables() {
    return this.maps.map(map => map.cmd);
  }

  get(cmd: string) {
    const map = this.maps.find(map => map.cmd == cmd);
    if (!map) {
      throw Error(`Unknown command ${cmd}`);
    }
    return map;
  }

  exec(cmd: string, options: any): Promise<any> {
    return this.get(cmd).exec(options);
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

  commit({message, args}) {
    return this.git.commit(message, args);
  }

  tag({args}) {
    return this.git.tag(args);
  }

  stash({args}) {
    return this.git.stash(args);
  }

  rebase({args}) {
    return this.git.rebase(args);
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
