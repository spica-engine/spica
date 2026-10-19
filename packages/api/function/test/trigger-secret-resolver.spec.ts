import {ChangeKind, TargetChange} from "@spica-server/interface-function";
import {ObjectId} from "@spica-server/database";
import {TriggerSecretResolver} from "@spica-server/function/src/trigger-secret-resolver";

describe("TriggerSecretResolver failures", () => {
  const goodId = new ObjectId();
  const badId = new ObjectId();

  const change = (id: ObjectId, url: string): TargetChange => ({
    kind: ChangeKind.Added,
    type: "rabbitmq",
    options: {url},
    target: {id: id.toString(), handler: "default"}
  });

  const functionService = (toArray: jest.Mock) => ({aggregate: () => ({toArray})}) as any;
  const secretOf = (key: string, value: string) => ({key, value});

  it("should skip every subscription with placeholders when the lookup fails", async () => {
    const resolver = new TriggerSecretResolver(
      functionService(jest.fn().mockRejectedValue(new Error("db down"))),
      (secret => secret) as any
    );
    const plain = change(goodId, "amqp://localhost");

    const routing = await resolver.resolve([change(goodId, "amqp://${SECRET.USER}@host"), plain]);

    expect(routing).toEqual([plain]);
  });

  it("should only skip the function whose secret cannot be decrypted", async () => {
    const decryptor = jest.fn(secret => {
      if (secret.key == "BAD") {
        throw new Error("cannot decrypt");
      }
      return secret;
    });
    const resolver = new TriggerSecretResolver(
      functionService(
        jest.fn().mockResolvedValue([
          {_id: goodId, secrets: [secretOf("USER", "admin")]},
          {_id: badId, secrets: [secretOf("BAD", "x")]}
        ])
      ),
      decryptor as any
    );

    const routing = await resolver.resolve([
      change(goodId, "amqp://${SECRET.USER}@host"),
      change(badId, "amqp://${SECRET.BAD}@host")
    ]);

    expect(routing.map(r => r.options)).toEqual([{url: "amqp://admin@host"}]);
  });
});
