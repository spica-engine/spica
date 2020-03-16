import {validators} from "@ionic/cli-framework";
import {context} from "@spica/cli/src/authentication";
import {DependencyNamespace, InstallCommand} from "@spica/cli/src/commands/function/dependency";
import {request} from "@spica/cli/src/request";

describe("Install", () => {
  let installCommand: InstallCommand;
  let dependencyNamespace: DependencyNamespace;
  let loginError: jasmine.Spy;
  let logSuccess: jasmine.Spy;
  let getLoginData: jasmine.Spy;
  let getRequest: jasmine.Spy;
  let logError: jasmine.Spy;
  let postRequest: jasmine.Spy;

  beforeEach(() => {
    dependencyNamespace = new DependencyNamespace();
    installCommand = new InstallCommand(dependencyNamespace);

    logSuccess = spyOn(installCommand.logger, "success");
    loginError = spyOn(installCommand, "showLoginError");

    getRequest = spyOn(request, "get");
    logError = spyOn(installCommand.logger, "error");
    postRequest = spyOn(request, "post");

    getLoginData = spyOn(context, "data").and.callFake(() => Promise.reject());
  });

  it("should return metaData", async () => {
    const metaData = await installCommand.getMetadata();
    expect(metaData).toEqual({
      name: "install",
      summary: "Install npm-package to function.",
      inputs: [
        {
          name: "package-name",
          summary: "The name of npm-package that will be installed.",
          validators: [validators.required]
        }
      ],
      options: [
        {
          name: "all",
          summary: "Install specified npm-package to each function.",
          type: Boolean
        }
      ]
    });
  });

  function loginSuccessfully() {
    installCommand.server = "https:/localhost:4300";
    installCommand.token = "JWT 12345";
  }

  function getFunctionsSuccessfully() {
    getRequest.and.returnValue(
      Promise.resolve([{_id: "id1", name: "func1"}, {_id: "id2", name: "func2"}])
    );
  }

  it("should show login error and return", async () => {
    getLoginData.and.callFake(() => Promise.reject());

    await installCommand.validate({} as any);

    expect(getLoginData).toHaveBeenCalledTimes(1);
    expect(loginError).toHaveBeenCalledTimes(1);

    await installCommand.run(["some-package-name"], {all: true});

    expect(getRequest).toHaveBeenCalledTimes(0);
  });

  it("should show error when server reject get function request", async () => {
    loginSuccessfully();

    getRequest.and.returnValue(
      new Promise((resolve, reject) => {
        reject({message: "Unknown server error"});
      })
    );

    await installCommand.run(["some-package-name"], {all: true});

    expect(getRequest).toHaveBeenCalledTimes(1);
    expect(getRequest).toHaveBeenCalledWith("https:/localhost:4300/function", {
      Authorization: "JWT 12345"
    });

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith("Unknown server error");

    expect(postRequest).toHaveBeenCalledTimes(0);
  });

  it("should show 'Couldn't find any function.' error", async () => {
    loginSuccessfully();

    getRequest.and.returnValue(
      new Promise((resolve, reject) => {
        resolve([]);
      })
    );

    await installCommand.run(["some-package-name"], {all: true});

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith("Couldn't find any function.");

    expect(postRequest).toHaveBeenCalledTimes(0);
  });

  it("should show 'Failed to install dependency error..'", async () => {
    loginSuccessfully();
    getFunctionsSuccessfully();

    postRequest.and.returnValue(Promise.reject({message: "Bad Request."}));

    await installCommand.run(["some-package-name"], {all: true});

    expect(postRequest).toHaveBeenCalledTimes(2);
    expect(postRequest.calls.all().map(call => call.args)).toEqual([
      [
        "https:/localhost:4300/function/id1/dependencies",
        {
          name: "some-package-name"
        },
        {
          Authorization: "JWT 12345"
        }
      ],
      [
        "https:/localhost:4300/function/id2/dependencies",
        {
          name: "some-package-name"
        },
        {
          Authorization: "JWT 12345"
        }
      ]
    ]);

    expect(logError).toHaveBeenCalledTimes(2);
    expect(logError.calls.all().map(call => call.args)).toEqual([
      [
        "Failed to install dependency 'some-package-name' to the function named 'func1' cause of Bad Request."
      ],
      [
        "Failed to install dependency 'some-package-name' to the function named 'func2' cause of Bad Request."
      ]
    ]);

    expect(logSuccess).toHaveBeenCalledTimes(0);
  });

  it("should run command successfully.", async () => {
    loginSuccessfully();
    getFunctionsSuccessfully();

    postRequest.and.returnValue(Promise.resolve());
    await installCommand.run(["some-package-name"], {all: true});

    expect(logSuccess).toHaveBeenCalledTimes(2);
    expect(logSuccess.calls.all().map(call => call.args)).toEqual([
      ["Successfully installed dependency 'some-package-name' to the function named 'func1'."],
      ["Successfully installed dependency 'some-package-name' to the function named 'func2'."]
    ]);
  });
});
