import {StorageModule} from "./storage.module";

describe("StorageModule", () => {
  let storageModule: StorageModule;

  beforeEach(() => {
    storageModule = new StorageModule();
  });

  it("should create an instance", () => {
    expect(storageModule).toBeTruthy();
  });
});
