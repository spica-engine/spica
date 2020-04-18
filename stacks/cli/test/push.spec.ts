import {NamespaceMetadata} from "@ionic/cli-framework";
import {context} from "@spica/cli/src/authentication";
import {PushCommand, chunk} from "@spica/cli/src/commands/push";
import {SpicaNamespace, Asset} from "@spica/cli/src/interface";
import {Logger} from "@spica/cli/src/logger";
import {request} from "@spica/cli/src/request";
import * as fs from "fs";
import * as ora from "ora";
import * as os from "os";
import * as path from "path";
import * as yaml from "yaml";

describe("push", () => {
  let post: jasmine.Spy<typeof request.post>;
  let del: jasmine.Spy<typeof request.del>;
  let get: jasmine.Spy<typeof request.get>;
  let hasAuthorization: jasmine.Spy<typeof context.hasAuthorization>;
  let authorizationHeaders: jasmine.Spy<typeof context.authorizationHeaders>;
  let url: jasmine.Spy<typeof context.url>;
  let command: PushCommand;
  let logger: jasmine.SpyObj<Logger>;
  let spinner: jasmine.SpyObj<ora.Ora>;
  let exclusive: jasmine.Spy;
  let concurrent: jasmine.Spy;

  let fakeResponses: Map<string, unknown>;

  beforeEach(() => {
    const dir = path.join(os.tmpdir(), fs.mkdtempSync("testing"));
    fs.mkdirSync(dir, {recursive: true});
    process.chdir(dir);

    fs.mkdirSync("test/5e5e3831dc1304d8f20a99f6", {recursive: true});
    fs.writeFileSync(
      "test/package.yaml",
      yaml.stringify([
        {
          kind: "Function",
          metadata: {name: "5e5e3831dc1304d8f20a99f6"},
          spec: {
            name: "Testing",
            triggers: {
              default: {
                type: "http",
                active: true,
                options: {preflight: true, method: "Get", path: "/insert"}
              }
            },
            indexPath: "5e5e3831dc1304d8f20a99f6/index.ts",
            dependencies: [{name: "debug", version: "latest"}]
          }
        }
      ])
    );
    fs.writeFileSync("test/5e5e3831dc1304d8f20a99f6/index.ts", "export default function () {}");
  });

  beforeEach(() => {
    fakeResponses = fakeResponses = new Map<string, unknown>([
      [
        "/function",
        [
          {
            _id: "5e5e3831dc1304d8f20a99f6",
            name: "Testing",
            triggers: {
              default: {
                type: "http",
                active: true,
                options: {preflight: true, method: "Get", path: "/insert"}
              }
            }
          }
        ]
      ]
    ]);

    hasAuthorization = spyOn(context, "hasAuthorization").and.returnValue(Promise.resolve(true));

    authorizationHeaders = spyOn(context, "authorizationHeaders").and.returnValue(
      Promise.resolve({} as any)
    );

    url = spyOn(context, "url").and.callFake(url => Promise.resolve(url));

    post = spyOn(request, "post").and.returnValue(Promise.resolve({_id: "newid"}));
    del = spyOn(request, "del");
    get = spyOn(request, "get").and.callFake(<T>(url) =>
      Promise.resolve((fakeResponses.get(url) as unknown) as T)
    );

    logger = jasmine.createSpyObj("logger", ["spin", "error", "success", "info"]);
    logger.spin.and.callFake(options => {
      spinner = jasmine.createSpyObj("ora", ["start", "fail", "succeed"]);
      if (typeof options.op == "function") {
        options.op = options.op(spinner);
      }
      if (options.op instanceof Promise) {
        return options.op;
      }
      return spinner;
    });

    command = new PushCommand(
      new (class extends SpicaNamespace {
        logger = logger;

        getMetadata(): Promise<NamespaceMetadata> {
          return Promise.resolve(<NamespaceMetadata>{});
        }
      })()
    );
  });

  it("should fail if there is no authorization", async () => {
    hasAuthorization.and.returnValue(Promise.resolve(false));
    const result = await command.run(["test"], {
      package: "package.yaml",
      push_strategy: "exclusive"
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(result).not.toBeTruthy();
  });

  it("should fetch and delete remote functions", async () => {
    await command.run(["test"], {package: "package.yaml", push_strategy: "exclusive"});
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.calls.argsFor(0)[0]).toBe("/function");
    expect(del).toHaveBeenCalledTimes(1);
    expect(del.calls.argsFor(0)[0]).toBe("/function/5e5e3831dc1304d8f20a99f6");
  });

  it("should overwrite functions", async () => {
    await command.run(["test"], {package: "package.yaml", push_strategy: "exclusive"});
    expect(post).toHaveBeenCalledTimes(3);
    const [url, body] = post.calls.argsFor(0);
    expect(url).toBe("/function");
    expect(body).toEqual({
      name: "Testing",
      triggers: {
        default: {
          type: "http",
          active: true,
          options: {preflight: true, method: "Get", path: "/insert"}
        }
      }
    });

    const [indexUrl, indexBody] = post.calls.argsFor(1);
    expect(indexUrl).toBe("/function/newid/index");
    expect(indexBody).toEqual({index: "export default function () {}"});
  });

  it("should add function dependencies", async () => {
    await command.run(["test"], {package: "package.yaml", push_strategy: "exclusive"});
    expect(post).toHaveBeenCalledTimes(3);
    const [url, body] = post.calls.argsFor(2);
    expect(url).toBe("/function/newid/dependencies");
    expect(body).toEqual({
      name: `debug@latest`
    });
  });

  it("should split assets to the parts of given limit", () => {
    const assets: Asset[] = [
      {
        kind: "function",
        metadata: {
          name: "asset1"
        },
        spec: {}
      },
      {
        kind: "function",
        metadata: {
          name: "asset2"
        },
        spec: {}
      },
      {
        kind: "function",
        metadata: {
          name: "asset3"
        },
        spec: {}
      }
    ];

    expect(chunk(assets, 2)).toEqual([
      [
        {
          kind: "function",
          metadata: {
            name: "asset1"
          },
          spec: {}
        },
        {
          kind: "function",
          metadata: {
            name: "asset2"
          },
          spec: {}
        }
      ],
      [
        {
          kind: "function",
          metadata: {
            name: "asset3"
          },
          spec: {}
        }
      ]
    ]);
  });

  it("should call exclusive method", async () => {
    exclusive = spyOn(command, "exclusive").and.callThrough();
    await command.run(["test"], {package: "package.yaml", push_strategy: "exclusive"});
    expect(exclusive).toHaveBeenCalledTimes(1);
    expect(exclusive).toHaveBeenCalledWith(
      [
        {
          kind: "Function",
          metadata: {name: "5e5e3831dc1304d8f20a99f6"},
          spec: {
            name: "Testing",
            triggers: {
              default: {
                type: "http",
                active: true,
                options: {preflight: true, method: "Get", path: "/insert"}
              }
            },
            indexPath: "5e5e3831dc1304d8f20a99f6/index.ts",
            dependencies: [{name: "debug", version: "latest"}]
          }
        }
      ],
      "/function",
      {},
      spinner
    );
  });

  it("should call concurrent method", async () => {
    concurrent = spyOn(command, "concurrent").and.callThrough();
    await command.run(["test"], {package: "package.yaml", push_strategy: "concurrent"});
    expect(concurrent).toHaveBeenCalledTimes(1);
    expect(concurrent).toHaveBeenCalledWith(
      [
        {
          kind: "Function",
          metadata: {name: "5e5e3831dc1304d8f20a99f6"},
          spec: {
            name: "Testing",
            triggers: {
              default: {
                type: "http",
                active: true,
                options: {preflight: true, method: "Get", path: "/insert"}
              }
            },
            indexPath: "5e5e3831dc1304d8f20a99f6/index.ts",
            dependencies: [{name: "debug", version: "latest"}]
          }
        }
      ],
      "/function",
      {},
      spinner
    );
  });

  it("should call concurrent with parts of asset", async () => {
    fs.writeFileSync(
      "test/package.yaml",
      yaml.stringify([
        {
          kind: "Function",
          metadata: {name: "5e5e3831dc1304d8f20a99f6"},
          spec: {
            name: "Testing1",
            triggers: {
              default: {
                type: "http",
                active: true,
                options: {preflight: true, method: "Get", path: "/insert"}
              }
            },
            indexPath: "5e5e3831dc1304d8f20a99f6/index.ts",
            dependencies: [{name: "debug", version: "latest"}]
          }
        },
        {
          kind: "Function",
          metadata: {name: "5e5e3831dc1304d8f20a99f6"},
          spec: {
            name: "Testing2",
            triggers: {
              default: {
                type: "http",
                active: true,
                options: {preflight: true, method: "Get", path: "/insert"}
              }
            },
            indexPath: "5e5e3831dc1304d8f20a99f6/index.ts",
            dependencies: [{name: "debug", version: "latest"}]
          }
        },
        {
          kind: "Function",
          metadata: {name: "5e5e3831dc1304d8f20a99f6"},
          spec: {
            name: "Testing3",
            triggers: {
              default: {
                type: "http",
                active: true,
                options: {preflight: true, method: "Get", path: "/insert"}
              }
            },
            indexPath: "5e5e3831dc1304d8f20a99f6/index.ts",
            dependencies: [{name: "debug", version: "latest"}]
          }
        }
      ])
    );

    concurrent = spyOn(command, "concurrent").and.callThrough();
    await command.run(["test"], {package: "package.yaml", push_strategy: "2"});

    expect(concurrent).toHaveBeenCalledTimes(2);
    expect(concurrent.calls.argsFor(0)[0]).toEqual([
      {
        kind: "Function",
        metadata: {name: "5e5e3831dc1304d8f20a99f6"},
        spec: {
          name: "Testing1",
          triggers: {
            default: {
              type: "http",
              active: true,
              options: {preflight: true, method: "Get", path: "/insert"}
            }
          },
          indexPath: "5e5e3831dc1304d8f20a99f6/index.ts",
          dependencies: [{name: "debug", version: "latest"}]
        }
      },
      {
        kind: "Function",
        metadata: {name: "5e5e3831dc1304d8f20a99f6"},
        spec: {
          name: "Testing2",
          triggers: {
            default: {
              type: "http",
              active: true,
              options: {preflight: true, method: "Get", path: "/insert"}
            }
          },
          indexPath: "5e5e3831dc1304d8f20a99f6/index.ts",
          dependencies: [{name: "debug", version: "latest"}]
        }
      }
    ]);

    expect(concurrent.calls.argsFor(1)[0]).toEqual([
      {
        kind: "Function",
        metadata: {name: "5e5e3831dc1304d8f20a99f6"},
        spec: {
          name: "Testing3",
          triggers: {
            default: {
              type: "http",
              active: true,
              options: {preflight: true, method: "Get", path: "/insert"}
            }
          },
          indexPath: "5e5e3831dc1304d8f20a99f6/index.ts",
          dependencies: [{name: "debug", version: "latest"}]
        }
      }
    ]);
  });
});
