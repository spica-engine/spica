import uniqid from "uniqid";
import {
  ReplicationServiceOptions,
  MemoryOptions,
  CommandMessengerOptions
} from "@spica-server/interface/replication";

export const replicationServiceOptions: ReplicationServiceOptions = {
  expireAfterSeconds: 60 * 60,
  jobExpireAfterSeconds: 5 * 60
};

export const commandMemoryOptions: MemoryOptions = {
  changeType: ["insert"]
};

export const conditionMemoryOptions: MemoryOptions = {
  changeType: ["insert", "update", "replace", "delete"]
};

export const commandMessengerOptions: CommandMessengerOptions = {
  listenOwnCommands: false
};

export const replicaIdProvider = () => {
  // we could use process id to track which api failed to execute command, publish etc.
  return uniqid();
};
