import type {Message} from "rabbitmq-stream-js-client/dist/publisher.js";

export function serialize(message: Message): string {
  const {content: _content, ...rest} = message;
  return JSON.stringify(rest, function (key, value) {
    const original = this[key];
    if (typeof original === "bigint") {
      return {type: "BigInt", value: original.toString()};
    }
    if (original instanceof Date) {
      return {type: "Date", value: original.toISOString()};
    }
    if (original?.constructor?.name === "AmqpByte") {
      return {type: "AmqpByte", value: original.byteValue};
    }
    return value;
  });
}
