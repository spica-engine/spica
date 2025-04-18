import {PartialObserver} from "rxjs";

interface IPublisher<T> {
  publish(msg: T): void;
}

interface ISubscriber<T> {
  subscribe(observer: PartialObserver<T>): {unsubscribe: () => void};
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

export interface ReplicationServiceOptions {
  expireAfterSeconds: number;
}

export interface MemoryOptions {
  changeType: ChangeType[];
}

type ChangeType = "insert" | "update" | "replace" | "delete";

export enum CommandType {
  /**
   * Propagate the call to all instances except itself
   */
  SHIFT,
  /**
   * Propagate the call to all instances
   */
  SYNC
}

export const REPLICATION_SERVICE_OPTIONS = Symbol.for("REPLICATION_SERVICE_OPTIONS");

export const COMMAND_MEMORY_OPTIONS = Symbol.for("COMMAND_MEMORY_OPTIONS");

export const REPLICA_ID = Symbol.for("REPLICA_ID");
