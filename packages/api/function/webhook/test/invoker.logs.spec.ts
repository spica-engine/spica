import {Logger} from "@nestjs/common";
import {ChangeKind} from "@spica-server/interface-function-webhook";
import {Subject} from "rxjs";
import {WebhookInvoker} from "../src/invoker";

describe("Webhook invoker logs", () => {
  const webhook = {
    title: "hook",
    url: "http://insteadof.invalid",
    body: "{{{ missing.value }}}",
    trigger: {active: true, options: {collection: "bucket_x", type: "INSERT"}}
  };

  let targets: Subject<any>;
  let changes: Subject<any>;
  let inserts: jest.Mock;
  let logged: jest.SpyInstance;

  beforeEach(() => {
    targets = new Subject();
    changes = new Subject();
    inserts = jest.fn();
    logged = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    new WebhookInvoker(
      {targets: () => targets} as any,
      {watch: () => changes} as any,
      {insert: inserts} as any
    );
    targets.next({kind: ChangeKind.Added, target: "webhook-id", webhook});
  });

  afterEach(() => jest.restoreAllMocks());

  const emitChange = () =>
    changes.next({operationType: "insert", fullDocument: {}, documentKey: {_id: "1"}});

  it("should record a template that can not be rendered", async () => {
    inserts.mockResolvedValue(undefined);

    emitChange();

    expect(inserts).toHaveBeenCalledWith(
      expect.objectContaining({succeed: false, webhook: "webhook-id"})
    );
  });

  it("should log, not reject, when the record can not be stored", async () => {
    inserts.mockRejectedValue(new Error("connection lost"));

    emitChange();
    await new Promise(resolve => setImmediate(resolve));

    expect(logged).toHaveBeenCalledWith(expect.stringContaining("connection lost"));
  });
});
