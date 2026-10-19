import {ChangeKind, TargetChange} from "@spica-server/interface-function";
import {ObjectId} from "@spica-server/database";
import {TriggerSecretResolver} from "@spica-server/function/src/trigger-secret-resolver";

describe("TriggerSecretResolver failures", () => {
  const fnA = new ObjectId();
  const fnB = new ObjectId();

  const change = (id: ObjectId, url: string, handler = "default"): TargetChange => ({
    kind: ChangeKind.Added,
    type: "rabbitmq",
    options: {url},
    target: {id: id.toString(), handler}
  });

  const functionService = (toArray: jest.Mock) => ({aggregate: () => ({toArray})}) as any;
  const secretOf = (key: string, value: string) => ({key, value});

  it("should keep every change with its placeholders when the lookup fails", async () => {
    const resolver = new TriggerSecretResolver(
      functionService(jest.fn().mockRejectedValue(new Error("db down"))),
      (secret => secret) as any
    );
    const routing = [change(fnA, "amqp://${SECRET.USER}@host"), change(fnB, "amqp://localhost")];

    expect(await resolver.resolve(routing)).toEqual(routing);
  });

  it("should leave only the undecryptable secret unresolved and resolve everything else", async () => {
    const decryptor = jest.fn(secret => {
      if (secret.key == "BAD") {
        throw new Error("cannot decrypt");
      }
      return secret;
    });
    const resolver = new TriggerSecretResolver(
      functionService(
        jest.fn().mockResolvedValue([
          {_id: fnA, secrets: [secretOf("USER", "admin"), secretOf("BAD", "x")]},
          {_id: fnB, secrets: [secretOf("USER", "other")]}
        ])
      ),
      decryptor as any
    );

    const routing = await resolver.resolve([
      change(fnA, "amqp://${SECRET.USER}@host", "first"),
      change(fnA, "amqp://${SECRET.BAD}@host", "second"),
      change(fnB, "amqp://${SECRET.USER}@host")
    ]);

    expect(routing.map(r => r.options)).toEqual([
      {url: "amqp://admin@host"},
      {url: "amqp://${SECRET.BAD}@host"},
      {url: "amqp://other@host"}
    ]);
  });
});
