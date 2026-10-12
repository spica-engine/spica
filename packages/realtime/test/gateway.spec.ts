import {describe, expect, it, jest} from "@jest/globals";
import {getConnectionHandlers} from "@spica-server/realtime";

/**
 * The handlers are built from plain functions, so the whole surface can be driven without a websocket
 * server: `getCollectionName` is where the failure comes from and `client`/`req` only need the members
 * these two handlers touch.
 */
function build(overrides: {getCollectionName?: any; getFindOptions?: any} = {}) {
  const removeEmitter = jest.fn();
  const realtime = {
    find: jest.fn(() => ({pipe: () => ({subscribe: () => ({})})})),
    doesEmitterExist: jest.fn(() => true),
    removeEmitter
  };

  const handlers = getConnectionHandlers(
    {checkAuthorization: jest.fn()} as any,
    overrides.getCollectionName ?? (async () => "bucket_6abad0864018fd8b7d1dcc21"),
    overrides.getFindOptions ?? (async () => ({filter: {}})),
    (error: any) => ({kind: -1, status: error.status || 500, message: error.message}),
    realtime as any,
    undefined,
    "bucket:data:stream"
  );

  return {handlers, realtime, removeEmitter};
}

const client = () => ({send: jest.fn(), close: jest.fn(), upgradeReq: {}}) as any;

describe("realtime connection handlers", () => {
  /**
   * The regression this file exists for. `getCollectionName` raises on a request it cannot resolve
   * (`/bucket/<garbage>/data`), `handleDisconnect` did not catch it, and because the handler runs inside
   * an RxJS subscriber the rejection escaped as an unhandled error and **killed the API process**. One
   * websocket on a malformed path plus a close was enough, from any client.
   */
  it("does not reject when the request cannot be resolved", async () => {
    const {handlers, removeEmitter} = build({
      getCollectionName: async () => {
        throw new Error("undefined is not a valid object id.");
      }
    });

    await expect(handlers.handleDisconnect(client(), {params: {}})).resolves.toBeUndefined();
    expect(removeEmitter).not.toHaveBeenCalled();
  });

  it("does not reject when the find options cannot be built", async () => {
    const {handlers, removeEmitter} = build({
      getFindOptions: async () => {
        throw new Error("invalid filter");
      }
    });

    await expect(handlers.handleDisconnect(client(), {params: {}})).resolves.toBeUndefined();
    expect(removeEmitter).not.toHaveBeenCalled();
  });

  it("still removes the emitter on a resolvable request", async () => {
    const {handlers, removeEmitter} = build();

    await handlers.handleDisconnect(client(), {params: {id: "6abad0864018fd8b7d1dcc21"}});
    expect(removeEmitter).toHaveBeenCalledTimes(1);
  });
});
