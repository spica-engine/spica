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
