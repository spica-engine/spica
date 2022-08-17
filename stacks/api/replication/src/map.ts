import {Injectable} from "@nestjs/common";
import {ClassCommander} from "@spica-server/replication";

@Injectable()
export class ReplicationMap<K, V> extends Map<K, V> {
  constructor(private commander: ClassCommander, private name: string) {
    super();
    this.commander.register(this);
  }

  set(key: K, value: V): this {
    this.emitCmd("set", [key, value]);
    return super.set(key, value);
  }

  clear(): void {
    this.emitCmd("clear", undefined);
    super.clear();
  }

  private emitCmd(handler: string, args: any[]) {
    // we cannot use this class name since it's same for each generation
    this.commander.emit({command: {class: this.name, handler, args}});
  }
}
