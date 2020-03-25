import {
  BaseCommand,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  Namespace
} from "@ionic/cli-framework";
import {Logger} from "./logger";

export abstract class SpicaNamespace extends Namespace {
  abstract logger?: Logger;
}

export abstract class Command extends BaseCommand<
  Command,
  SpicaNamespace,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption
> {}

export interface Function {
  _id?: string;
  name?: string;
  description?: string;
  env?: Environment;
  triggers: Triggers;
  memoryLimit?: number;
  timeout?: number;
  indexPath?: string;
  dependencies?: string;
}

export interface Triggers {
  [key: string]: Trigger;
}

export interface Trigger {
  type: string;
  active?: boolean;
  options: any;
}

export interface Environment {
  [key: string]: string;
}

export interface Dependency {
  [key: string]: string;
}

export interface Asset {
  kind: string;
  metadata: Metadata;
  spec: any;
}

export interface Metadata {
  name: string; //id
}

export interface LoginData {
  token: string;
  server: string;
}
