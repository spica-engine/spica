import {VersionManager} from "./interface";
import {Injectable} from "@nestjs/common";
import simpleGit, {SimpleGit} from "simple-git";

@Injectable()
export class Git implements VersionManager {
  private getCommonSchema() {
    return {
      args: {
        type: "array",
        items: {
          type: "string"
        }
      }
    };
  }

  private git: SimpleGit;

  private maps: {
    cmd: string;
    exec: Function;
    schema: {[key: string]: any};
  }[] = [
    {
      cmd: "add",
      exec: ops => this.add(ops),
      schema: {
        files: {
          type: "array",
          items: {
            type: "string"
          }
        }
      }
    },
    {
      cmd: "commit",
      exec: ops => this.commit(ops),
      schema: {...this.getCommonSchema(), message: {type: "string"}}
    },
    {cmd: "reset", exec: ops => this.reset(ops), schema: this.getCommonSchema()},
    {cmd: "tag", exec: ops => this.tag(ops), schema: this.getCommonSchema()},
    {cmd: "stash", exec: ops => this.stash(ops), schema: this.getCommonSchema()},

    {cmd: "checkout", exec: ops => this.checkout(ops), schema: this.getCommonSchema()},
    {cmd: "branch", exec: ops => this.branch(ops), schema: this.getCommonSchema()},

    {cmd: "fetch", exec: ops => this.fetch(ops), schema: this.getCommonSchema()},
    {cmd: "pull", exec: ops => this.pull(ops), schema: this.getCommonSchema()},
    {cmd: "push", exec: ops => this.push(ops), schema: this.getCommonSchema()},
    {cmd: "merge", exec: ops => this.merge(ops), schema: this.getCommonSchema()},
    {cmd: "rebase", exec: ops => this.rebase(ops), schema: this.getCommonSchema()},

    {cmd: "remote", exec: ops => this.remote(ops), schema: this.getCommonSchema()},

    {cmd: "diff", exec: ops => this.diff(ops), schema: this.getCommonSchema()},
    {cmd: "log", exec: ops => this.log(ops), schema: this.getCommonSchema()}
  ];

  availables() {
    return this.maps.map(map => {
      return {
        command: map.cmd,
        schema: map.schema
      };
    });
  }

  exec(cmd: string, options: any): Promise<any> {
    const map = this.maps.find(map => map.cmd == cmd);
    if (!map) {
      return Promise.reject(`Unknown command ${cmd}`);
    }

    return map.exec(options);
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
