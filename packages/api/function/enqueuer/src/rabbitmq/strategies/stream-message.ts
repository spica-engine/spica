import type {Message} from "rabbitmq-stream-js-client/dist/publisher.js";

export function serialize({content: _content, ...rest}: Message): string {
  return JSON.stringify(rest, stringifyBigInts);
}

function stringifyBigInts(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}
