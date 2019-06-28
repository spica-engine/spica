import {PlaintextPipe} from "./plaintext.pipe";

describe("PlaintextPipe", () => {
  it("create an instance", () => {
    const pipe = new PlaintextPipe();
    expect(pipe).toBeTruthy();
  });
});
