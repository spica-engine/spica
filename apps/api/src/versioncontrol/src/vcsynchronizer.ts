import {Injectable} from "@nestjs/common";
import {compareResourceGroups} from "@spica-server/core/differ";
import {Resource, Synchronizer, SynchronizerArgs} from "@spica-server/interface/versioncontrol";
import {
  Provider,
  SyncDirection,
  SyncLog,
  SyncProvider
} from "@spica-server/interface/versioncontrol";

@Injectable()
export class VCSynchronizer<R1 extends Resource, R2 extends Resource> extends Synchronizer<R1, R2> {
  constructor(args: SynchronizerArgs<R1, R2>) {
    super(args);
  }
}
