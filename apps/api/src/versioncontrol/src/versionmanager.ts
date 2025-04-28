import {VersionManager} from "./interface";
import {Injectable} from "@nestjs/common";
import simpleGit, {SimpleGit} from "simple-git";
import {JobReducer} from "@spica-server/replication";

@Injectable()
export class Git implements VersionManager {
  private git: SimpleGit;

  private maps: {
    name: string;
    exec: Function;
  }[] = [
    {name: "add", exec: ops => this.add(ops)},
    {name: "commit", exec: ops => this.commit(ops)},
    {name: "reset", exec: ops => this.reset(ops)},
    {name: "tag", exec: ops => this.tag(ops)},
    {name: "stash", exec: ops => this.stash(ops)},

    {name: "checkout", exec: ops => this.checkout(ops)},
    {name: "branch", exec: ops => this.branch(ops)},

    {name: "fetch", exec: ops => this.fetch(ops)},
    {name: "pull", exec: ops => this.pull(ops)},
    {name: "push", exec: ops => this.push(ops)},
    {name: "merge", exec: ops => this.merge(ops)},
    {name: "rebase", exec: ops => this.rebase(ops)},

    {name: "remote", exec: ops => this.remote(ops)},

    {name: "diff", exec: ops => this.diff(ops)},
    {name: "log", exec: ops => this.log(ops)},
    {name: "clean", exec: ops => this.clean(ops)},
    {name: "rm", exec: ops => this.rm(ops)}
  ];

  availables() {
    return this.maps.map(m => m.name).sort();
  }

  exec(name: string, options: any): Promise<any> {
    const map = this.maps.find(map => map.name == name);
    if (!map) {
      return Promise.reject(`Unknown command ${name}`);
    }

    return map.exec(options);
  }

  constructor(
    private cwd: string,
    private jobReducer?: JobReducer
  ) {
    this.git = simpleGit({baseDir: this.cwd, binary: "git", maxConcurrentProcesses: 6});

    const gitInit = () => {
      this.git.init().then(() => {
        this.git.addConfig("user.name", "Spica", false, "worktree");
        this.git.addConfig("user.email", "Spica", false, "worktree");
      });
    };

    if (jobReducer) {
      const meta = {
        _id: "git-init"
      };
      jobReducer.do(meta, gitInit);
    } else {
      gitInit();
    }
  }

  checkout({args}) {
    return this.git.checkout(args);
  }

  branch({args}) {
    return this.git.branch(args);
  }

  add({args}) {
    return this.git.add(args);
  }

  commit({args}) {
    // this command will be executed with -m as default
    // we shouldn't specify it again
    args = args.filter(arg => arg != "-m");

    const messageIndex = args.findIndex(
      arg => arg.startsWith("`") || arg.startsWith("'") || arg.startsWith('"')
    );
    const message = args[messageIndex];
    args = args.slice(messageIndex + 1);

    return this.git.commit(message, args);
  }

  clean({args}) {
    // clean method only accepts options without dash
    args = args.map(arg => arg.replace("-", ""));
    return this.git.clean(args);
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

  rm({args}) {
    return this.git.rm(args);
  }
}
