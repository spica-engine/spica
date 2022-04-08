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
    name: string;
    exec: Function;
    schema: {[key: string]: any};
  }[] = [
    {
      name: "add",
      exec: ops => this.add(ops),
      schema: {
        files: {
          required: true,
          type: "array",
          items: {
            type: "string"
          }
        }
      }
    },
    {
      name: "commit",
      exec: ops => this.commit(ops),
      schema: {message: {type: "string", required: true}, ...this.getCommonSchema()}
    },
    {name: "reset", exec: ops => this.reset(ops), schema: this.getCommonSchema()},
    {name: "tag", exec: ops => this.tag(ops), schema: this.getCommonSchema()},
    {name: "stash", exec: ops => this.stash(ops), schema: this.getCommonSchema()},

    {name: "checkout", exec: ops => this.checkout(ops), schema: this.getCommonSchema()},
    {name: "branch", exec: ops => this.branch(ops), schema: this.getCommonSchema()},

    {name: "fetch", exec: ops => this.fetch(ops), schema: this.getCommonSchema()},
    {name: "pull", exec: ops => this.pull(ops), schema: this.getCommonSchema()},
    {name: "push", exec: ops => this.push(ops), schema: this.getCommonSchema()},
    {name: "merge", exec: ops => this.merge(ops), schema: this.getCommonSchema()},
    {name: "rebase", exec: ops => this.rebase(ops), schema: this.getCommonSchema()},

    {name: "remote", exec: ops => this.remote(ops), schema: this.getCommonSchema()},

    {name: "diff", exec: ops => this.diff(ops), schema: this.getCommonSchema()},
    {name: "log", exec: ops => this.log(ops), schema: this.getCommonSchema()}
  ];

  availables() {
    return this.maps.reduce((acc, curr) => {
      acc[curr.name] = curr.schema;
      return acc;
    }, {});
  }

  exec(name: string, options: any): Promise<any> {
    const map = this.maps.find(map => map.name == name);
    if (!map) {
      return Promise.reject(`Unknown command ${name}`);
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
    // this command will be executed with -m as default
    // we shouldn't specify it again
    args = args.filter(arg => arg != "-m")
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
