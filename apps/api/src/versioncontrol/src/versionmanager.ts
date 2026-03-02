import {VersionManager} from "./interface";
import {Injectable} from "@nestjs/common";
import simpleGit, {SimpleGit} from "simple-git";
import {JobReducer} from "@spica-server/replication";

// Flags that enable arbitrary command execution or override git internals
const DANGEROUS_ARG_PATTERNS: RegExp[] = [
  /^--upload-pack(=|$)/i,
  /^--receive-pack(=|$)/i,
  /^--exec(=|$)/i,
  /^-c$/i,
  /^--config(=|$)/i,
  /^--git-dir(=|$)/i,
  /^--work-tree(=|$)/i,
  /^--output(=|$)/i
];

const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;

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

    try {
      options = {...options, args: this.sanitizeArgs(options?.args)};
    } catch (e) {
      return Promise.reject(e);
    }

    return map.exec(options);
  }

  private sanitizeArgs(args: unknown): string[] {
    if (args === undefined || args === null) {
      return [];
    }

    if (!Array.isArray(args)) {
      throw new Error("Arguments must be an array");
    }

    return args.map((arg, i) => {
      if (typeof arg !== "string") {
        throw new Error(`Argument at index ${i} must be a string`);
      }

      if (CONTROL_CHAR_PATTERN.test(arg)) {
        throw new Error(`Argument at index ${i} contains disallowed control characters`);
      }

      for (const pattern of DANGEROUS_ARG_PATTERNS) {
        if (pattern.test(arg)) {
          throw new Error(`Argument "${arg}" is not allowed`);
        }
      }

      return arg;
    });
  }

  constructor(
    private cwd: string,
    private jobReducer?: JobReducer
  ) {
    this.git = simpleGit({baseDir: this.cwd, binary: "git", maxConcurrentProcesses: 6});

    const gitInit = async () => {
      await this.git.init();
      await this.git.addConfig("user.name", "Spica", true, "worktree");
      await this.git.addConfig("user.email", "Spica", true, "worktree");
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
    const message = args[messageIndex]?.replace(/['"`]/g, "");
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
