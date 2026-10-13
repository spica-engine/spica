import type {Message} from "rabbitmq-stream-js-client/dist/publisher.js";

export function serialize({content: _content, offset, ...rest}: Message): string {
  return JSON.stringify({...rest, offset: offset?.toString()});
}
