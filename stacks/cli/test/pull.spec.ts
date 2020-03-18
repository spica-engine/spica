import {NamespaceMetadata} from "@ionic/cli-framework";
import {context} from "@spica/cli/src/authentication";
import {PullCommand} from "@spica/cli/src/commands/pull";
import {SpicaNamespace} from "@spica/cli/src/interface";
import {Logger} from "@spica/cli/src/logger";
import {request} from "@spica/cli/src/request";
import * as fs from "fs";
import * as ora from "ora";
import * as os from "os";
import * as path from "path";
import * as yaml from "yaml";

describe("pull", () => {
  let fakeResponses: Map<string, unknown>;
  let get: jasmine.Spy<typeof request.get>;
  let hasAuthorization: jasmine.Spy<typeof context.hasAuthorization>;
  let authorizationHeaders: jasmine.Spy<typeof context.authorizationHeaders>;
  let url: jasmine.Spy<typeof context.url>;
  let command: PullCommand;
  let logger: jasmine.SpyObj<Logger>;
  let spinner: jasmine.SpyObj<ora.Ora>;

  beforeEach(() => {
    const dir = path.join(os.tmpdir(), fs.mkdtempSync("testing"));
    fs.mkdirSync(dir, {recursive: true});
    process.chdir(dir);

    fakeResponses = new Map<string, unknown>([
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
      ],
      [
        "/function/5e5e3831dc1304d8f20a99f6/index",
        {
          index: "export default function() {}"
        }
      ],
      [
        "/function/5e5e3831dc1304d8f20a99f6/dependencies",
        [
          {
            name: "debug",
            version: "latest"
          }
        ]
      ]
    ]);

    hasAuthorization = spyOn(context, "hasAuthorization").and.returnValue(Promise.resolve(true));

    authorizationHeaders = spyOn(context, "authorizationHeaders").and.returnValue(
      Promise.resolve({} as any)
    );

    url = spyOn(context, "url").and.callFake(url => Promise.resolve(url));

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

    command = new PullCommand(
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
    const result = await command.run(["test"], {package: "package.yaml"});
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(result).not.toBeTruthy();
  });

  it("should fetch the functions and create files", async () => {
    await expectAsync(command.run(["test"], {package: "package.yaml"})).toBeResolved();
    expect(fs.readdirSync("test")).toEqual(["5e5e3831dc1304d8f20a99f6", "package.yaml"]);
    expect(fs.readdirSync("test/5e5e3831dc1304d8f20a99f6")).toEqual(["index.ts"]);
  });

  it("should fetch the function's index correctly", async () => {
    await expectAsync(command.run(["test"], {package: "package.yaml"})).toBeResolved();
    expect(fs.readFileSync("test/5e5e3831dc1304d8f20a99f6/index.ts").toString()).toBe(
      "export default function() {}"
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(spinner.succeed).toHaveBeenCalledTimes(1);
    expect(logger.success).toHaveBeenCalledTimes(1);
  });

  it("shoud create package.yaml correctly", async () => {
    await expectAsync(command.run(["test"], {package: "package.yaml"})).toBeResolved();
    expect(yaml.parse(fs.readFileSync("test/package.yaml").toString())).toEqual([
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
    ]);
  });
});
