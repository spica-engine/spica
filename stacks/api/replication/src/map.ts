import {Injectable} from "@nestjs/common";
import {ClassCommander} from "@spica-server/replication";

@Injectable()
export class ReplicationMap<K, V> extends Map<K, V> {
  constructor(private commander: ClassCommander, private name: string) {
    super();
    // this.commander = this.commander.updateFilters([ctx => ctx.source.command.class == name]);
    // this.commander.register(this);
  }

  set(key: K, value: V): this {
    this.emitCmd("superSet", [key, value]);
    return this.superSet(key, value);
  }

  private superSet(key, value) {
    return super.set(key, value);
  }

  delete(key: K): boolean {
    this.emitCmd("superDelete", [key]);
    return this.superDelete(key);
  }

  private superDelete(key) {
    return this.superDelete(key);
  }

  clear(): void {
    this.emitCmd("superClear", undefined);
    this.superClear();
  }

  private superClear() {
    super.clear();
  }

  private emitCmd(handler: string, args: any[]) {
    // we cannot use this class name since it's same for each generation
    // this.commander.emit({command: {class: this.name, handler, args}});
  }
}
