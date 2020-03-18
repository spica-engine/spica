import {context} from "@spica/cli/src/authentication";
import {DependencyNamespace} from "@spica/cli/src/commands/function/dependency";
import {InstallCommand} from "@spica/cli/src/commands/function/dependency/install";
import {Logger} from "@spica/cli/src/logger";
import {request} from "@spica/cli/src/request";
import * as ora from "ora";
import {PassThrough} from "stream";

describe("install", () => {
  let fakeResponses: Map<string, unknown>;
  let get: jasmine.Spy<typeof request.get>;
  let post: jasmine.Spy<typeof request.stream.post>;
  let hasAuthorization: jasmine.Spy<typeof context.hasAuthorization>;
  let authorizationHeaders: jasmine.Spy<typeof context.authorizationHeaders>;
  let url: jasmine.Spy<typeof context.url>;
  let command: InstallCommand;
  let logger: jasmine.SpyObj<Logger>;
  let spinner: jasmine.SpyObj<ora.Ora>;
  let spinnerText: jasmine.Spy;

  beforeEach(() => {
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

    post = spyOn(request.stream, "post");

    logger = jasmine.createSpyObj("logger", ["spin", "warn", "error", "info"]);
    logger.spin.and.callFake(options => {
      spinner = jasmine.createSpyObj("ora", ["start", "fail", "succeed"]);

      spinnerText = jasmine.createSpy("spinnerText");
      Object.defineProperty(spinner, "text", {set: spinnerText});

      if (typeof options.op == "function") {
        options.op = options.op(spinner);
      }
      if (options.op instanceof Promise) {
        return options.op;
      }
      return spinner;
    });

    command = new InstallCommand(new DependencyNamespace());

    command.logger = logger;
  });

  it("should fail if there is no authorization", async () => {
    hasAuthorization.and.returnValue(Promise.resolve(false));
    const result = await command.run(["test"], {package: "package.yaml"});
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(result).not.toBeTruthy();
  });

  it("should show an error if --all is not present", async () => {
    await command.run([""], {});
    expect(logger.warn).toHaveBeenCalledWith(
      "Option --all should be present as true otherwise it won't work."
    );
  });

  it("should install package to all functions", async () => {
    post.and.callFake(async () => {
      const stream = new PassThrough();
      stream.end();
      return stream;
    });
    await command.run(["debug@latest"], {all: true});
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.calls.argsFor(0)[0]).toBe("/function");
    expect(post).toHaveBeenCalledTimes(1);
    const [{url, body}] = post.calls.argsFor(0);
    expect(url).toBe("/function/5e5e3831dc1304d8f20a99f6/dependencies?progress=true");
    expect(body).toEqual({name: "debug@latest"});
  });

  it("should report installation failures", async () => {
    post.and.callFake(async () => {
      const stream = new PassThrough();
      stream.write(
        JSON.stringify({
          state: "error",
          message: "some nasty errors have been received from the server."
        })
      );
      stream.end();
      return stream;
    });
    await expectAsync(command.run(["debug@latest"], {all: true})).toBeRejectedWith(
      new Error("some nasty errors have been received from the server.")
    );
  });

  it("should report installation progress", async () => {
    post.and.callFake(async () => {
      const stream = new PassThrough();
      stream.write(
        JSON.stringify({
          state: "installing",
          progress: 10
        })
      );
      stream.write(
        JSON.stringify({
          state: "installing",
          progress: 50
        })
      );
      stream.write(
        JSON.stringify({
          state: "installing",
          progress: 100
        })
      );
      stream.end();
      return stream;
    });
    await command.run(["debug@latest"], {all: true});
    expect(spinnerText).toHaveBeenCalledWith(
      "Installing the package 'debug@latest' to functions (0/1) (10%)"
    );
    expect(spinnerText).toHaveBeenCalledWith(
      "Installing the package 'debug@latest' to functions (0/1) (50%)"
    );
    expect(spinnerText).toHaveBeenCalledWith(
      "Installing the package 'debug@latest' to functions (0/1) (100%)"
    );
    expect(spinnerText).toHaveBeenCalledWith(
      "Installing the package 'debug@latest' to functions (1/1)"
    );
  });
});
