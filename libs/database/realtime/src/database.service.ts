import {Injectable, OnModuleDestroy} from "@nestjs/common";
import {ChangeStream, DatabaseService, Document} from "@spica-server/database";
import {StreamChunk} from "@spica-server/interface/realtime";
import {Observable} from "rxjs";
import {FindOptions} from "@spica-server/interface/database";
import {Emitter} from "./stream";
import isEqual from "lodash/isEqual.js";

@Injectable()
export class RealtimeDatabaseService implements OnModuleDestroy {
  constructor(private database: DatabaseService) {}

  private changeStreams = new Map<string, ChangeStream>();
  private getChangeStream(name: string) {
    // if (this.changeStreams.has(name)) {
    //   return this.changeStreams.get(name);
    // }

    const changeStream = this.database.collection(name).watch([], {fullDocument: "updateLookup"});
    this.changeStreams.set(name, changeStream);

    return changeStream;
  }

  private emitters = new Map<string, {value: Emitter<any>; listenerCount: number}>();
  private getEmitter(name: string, options: FindOptions<any>) {
    let emitterName = this.findEmitterName(name, options);

    if (emitterName) {
      const emitter = this.emitters.get(emitterName);
      emitter.listenerCount++;
      return emitter.value;
    }

    const changeStream = this.getChangeStream(name);
    const emitter = {
      value: new Emitter(this.database.collection(name), changeStream, options),
      listenerCount: 1
    };

    emitterName = this.getUniqueEmitterName(name, options);
    this.emitters.set(emitterName, emitter);

    return emitter.value;
  }

  private findEmitterName(name: string, options: FindOptions<any>) {
    for (const key of this.emitters.keys()) {
      const emitterFilter = key.includes(name) ? JSON.parse(key.replace(name + "_", "")) : false;

      // we have to lose special types like ObjectId, Date in this options in order to compare it with emitterFilter correctly
      const pureOptions = JSON.parse(JSON.stringify(options));
      if (emitterFilter && isEqual(emitterFilter, pureOptions)) {
        return key;
      }
    }

    return undefined;
  }

  doesEmitterExist(name: string, options: FindOptions<any>) {
    return !!this.findEmitterName(name, options);
  }

  async onModuleDestroy() {
    await Promise.all(
      Array.from(this.emitters).map(([_, emitter]) => {
        const stream = this.changeStreams.get(emitter.value.collectionName);
        this.changeStreams.delete(emitter.value.collectionName);
        return this.closeStreamSafely(stream);
      })
    );
    this.emitters.clear();
    this.changeStreams.clear();
  }

  removeEmitter(name: string, options: FindOptions<any>) {
    const emitterName = this.findEmitterName(name, options);

    const emitter = this.emitters.get(emitterName);

    emitter.listenerCount--;

    if (emitter.listenerCount == 0) {
      this.emitters.delete(emitterName);
      const collName = emitter.value.collectionName;

      const streamListenersRemain = Array.from(this.emitters.values())
        .map(v => v.value.collectionName)
        .some(name => name == collName);

      if (!streamListenersRemain) {
        const changeStream = this.changeStreams.get(collName);
        this.closeStreamSafely(changeStream);
        this.changeStreams.delete(collName);
      }
    }
  }

  getUniqueEmitterName(name: string, options: FindOptions<any>) {
    return `${name}_${JSON.stringify(options)}`;
  }

  find<T extends Document = any>(
    name: string,
    options: FindOptions<T> = {}
  ): Observable<StreamChunk<T>> {
    return this.getEmitter(name, options).getObservable();
  }

  private closeStreamSafely(stream: ChangeStream) {
    // if (!stream.closed) {
    //   return stream.close();
    // } else {
    //   console.warn(
    //     `Change stream for collection ${stream.namespace.collection} is already closed.`
    //   );
    // }
  }
}
