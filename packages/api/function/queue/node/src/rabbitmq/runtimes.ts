import type {RuntimeStrategy} from "./runtime.js";
import {queueRuntime} from "./runtimes/queue.js";
import {streamRuntime} from "./runtimes/stream.js";

export const RABBITMQ_RUNTIMES: RuntimeStrategy[] = [queueRuntime, streamRuntime];
