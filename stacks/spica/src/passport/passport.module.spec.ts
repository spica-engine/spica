import {PassportModule} from "./passport.module";

describe("PassportModule", () => {
  let passportModule: PassportModule;

  beforeEach(() => {
    passportModule = new PassportModule();
  });

  it("should create an instance", () => {
    expect(passportModule).toBeTruthy();
  });
});
