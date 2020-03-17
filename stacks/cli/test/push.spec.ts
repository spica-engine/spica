import {NamespaceMetadata} from "@ionic/cli-framework";
import {context} from "@spica/cli/src/authentication";
import {PushCommand} from "@spica/cli/src/commands/push";
import {SpicaNamespace} from "@spica/cli/src/interface";
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
  let url: jasmine.Spy<typeof context.url>;
  let command: PushCommand;
  let logger: jasmine.SpyObj<Logger>;
  let spinner: jasmine.SpyObj<ora.Ora>;

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
    const result = await command.run(["test"], {package: "package.yaml"}).catch(e => e);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(result).not.toBeTruthy();
  });

  it("should fetch and delete remote functions", async () => {
    await command.run(["test"], {package: "package.yaml"});
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.calls.argsFor(0)[0]).toBe("/function");
    expect(del).toHaveBeenCalledTimes(1);
    expect(del.calls.argsFor(0)[0]).toBe("/function/5e5e3831dc1304d8f20a99f6");
  });

  it("should overwrite functions", async () => {
    await command.run(["test"], {package: "package.yaml"});
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
    await command.run(["test"], {package: "package.yaml"});
    expect(post).toHaveBeenCalledTimes(3);
    const [url, body] = post.calls.argsFor(2);
    expect(url).toBe("/function/newid/dependencies");
    expect(body).toEqual({
      name: `debug@latest`
    });
  });
});
