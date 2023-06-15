import {PartialObserver} from "rxjs";
import * as uniqid from "uniqid";

export interface IPublisher<T> {
  publish(msg: T): void;
}

export interface ISubscriber<T> {
  subscribe(observer: PartialObserver<T>);
}

export interface IPubSub<T> extends IPublisher<T>, ISubscriber<T> {}

export interface IJobReducer {
  do(meta: JobMeta, job: Function): Promise<boolean>;
}

export interface JobMeta {
  _id: string;
  [key: string]: any;
}

export interface CommandMessengerOptions {
  /**
   * default: false
   */
  listenOwnCommands?: boolean;
}

export type Message = CommandMessage;

export interface CommandMessage {
  _id?: string;
  source: CommandSource;
  target: CommandTarget;
}

export interface CommandSource {
  command: Command;
  id?: string;
}

export interface CommandTarget {
  commands: Command[];
  id?: string;
}

export interface Command {
  class: string;
  handler: string;
  args: any[];
}

export type Filter<T> = (arg: T) => boolean;

export type CommandMessageFilter = Filter<CommandMessage>;

export const REPLICATION_SERVICE_OPTIONS = Symbol.for("REPLICATION_SERVICE_OPTIONS");
export interface ReplicationServiceOptions {
  expireAfterSeconds: number;
}
export const replicationServiceOptions: ReplicationServiceOptions = {
  expireAfterSeconds: 60 * 60
};

export const COMMAND_MEMORY_OPTIONS = Symbol.for("COMMAND_MEMORY_OPTIONS");
export const CONDITION_MEMORY_OPTIONS = Symbol.for("CONDITION_MEMORY_OPTIONS");

export interface MemoryOptions {
  changeType: ChangeType[];
}

type ChangeType = "insert" | "update" | "replace" | "delete";

export const commandMemoryOptions: MemoryOptions = {
  changeType: ["insert"]
};

export const conditionMemoryOptions: MemoryOptions = {
  changeType: ["insert", "update", "replace", "delete"]
};

export const COMMAND_MESSENGER_OPTIONS = Symbol.for("COMMAND_MESSENGER_OPTIONS");
export const commandMessengerOptions: CommandMessengerOptions = {
  listenOwnCommands: false
};

export const MEMORY_SERVICE = Symbol.for("MEMORY_SERVICE");

export const REPLICA_ID = Symbol.for("REPLICA_ID");
export const replicaIdProvider = () => {
  // we could use process id to track which api failed to execute command, publish etc.
  return uniqid();
};
