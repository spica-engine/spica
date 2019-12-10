import * as request from "request-promise-native";

export abstract class SubscriptionExecutor {
  abstract execute(execution: SubscriptionExecution, body: object): Promise<unknown>;
}

export class RequestSubscriptionExecutor implements SubscriptionExecutor {
  execute(execution: SubscriptionExecution, body: object): Promise<unknown> {
    return request({
      url: execution.url,
      headers: {
        ...execution.headers,
        "User-Agent": "Subscriber-spica; (http://spicacms.io/docs/function/subscriber)"
      }
    });
  }
}

export interface SubscriptionExecution {
  url: string;
  headers?: {
    [key: string]: string;
  };
}
