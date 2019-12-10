import {wrapIntoObservable} from "./utils";
import {zip, of} from "rxjs";

describe("utils", () => {
  it("should wrap primitives into observable", done => {
    zip(
      wrapIntoObservable(1),
      wrapIntoObservable(true),
      wrapIntoObservable("2134"),
      wrapIntoObservable(Promise.resolve({})),
      wrapIntoObservable(of([]))
    ).subscribe(r => {
      expect(r).toEqual([1, true, "2134", {}, []]);
      done();
    });
  });
});
