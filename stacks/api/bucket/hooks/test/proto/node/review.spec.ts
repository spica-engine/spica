import {Review} from "@spica-server/bucket/hooks/proto/node";
import {hooks} from "@spica-server/bucket/hooks/proto";

describe("Review", () => {
  let rawReview: hooks.Review;

  beforeEach(() => {
    rawReview = new hooks.Review({
      bucket: "test_bucket",
      type: 0,
      headers: [
        new hooks.Review.Header({key: "authorization", value: "APIKEY 123123"}),
        new hooks.Review.Header({key: "content-type", value: "application/json"})
      ],
      documentKey: "document_id"
    });
  });

  it("should create and map", () => {
    const review = new Review(rawReview);
    expect(review.bucket).toEqual("test_bucket");
    expect(review.documentKey).toEqual("document_id");
    expect(review.headers.get("authorization")).toBe("APIKEY 123123");
    expect(review.headers.get("content-type")).toBe("application/json");
    expect(review.type).toEqual("insert");
  });

  it("should emit a deprecation warning when accessing to headers directly", () => {
    const review = new Review(rawReview);
    const emit = spyOn(process, "emitWarning");
    expect(emit).not.toHaveBeenCalled();
    expect(review.headers["authorization"]).toBe("APIKEY 123123");
    expect(emit).toHaveBeenCalledWith(
      `Accessing to headers with property access {  headers['authorization'] OR headers.authorization } is deprecated and will be removed soon.\n` +
        `Consider using { headers.get('authorization') }  instead.`,
      "Deprecated"
    );
  });

  it("should emit a deprecation warning when accessing to document property", () => {
    const review = new Review(rawReview);
    const emit = spyOn(process, "emitWarning");
    expect(emit).not.toHaveBeenCalled();
    expect(review.document).toBe("document_id");
    expect(emit).toHaveBeenCalledWith(
      "document is deprecated and will be removed soon. use documentKey instead.",
      "Deprecated"
    );
  });

  it("should not emit any deprecation warning when accessing to headers via get", () => {
    const review = new Review(rawReview);
    const emit = spyOn(process, "emitWarning");
    expect(emit).not.toHaveBeenCalled();
    expect(review.headers.get("authorization")).toBe("APIKEY 123123");
    expect(emit).not.toHaveBeenCalled();
  });
});
