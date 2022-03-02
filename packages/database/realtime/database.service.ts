import {Injectable} from "@nestjs/common";
import {ChangeStream, DatabaseService, Document} from "@spica-server/database";
import {Observable} from "rxjs";
import {FindOptions, StreamChunk} from "./interface";
import {Emitter} from "./stream";
const isEqual = require("lodash/isEqual");

@Injectable()
export class RealtimeDatabaseService {
  constructor(private database: DatabaseService) {}

  private changeStreams = new Map<string, ChangeStream>();
  private getChangeStream(coll: string) {
    if (this.changeStreams.has(coll)) {
      return this.changeStreams.get(coll);
    }

    const changeStream = this.database.collection(coll).watch([], {fullDocument: "updateLookup"});
    this.changeStreams.set(coll, changeStream);

    return changeStream;
  }

  private emitters = new Map<string, {value: Emitter<any>; listenerCount: number}>();
  private getEmitter(coll: string, options: FindOptions<any>) {
    let emitterName = this.findEmitterName(coll, options);

    if (emitterName) {
      const emitter = this.emitters.get(emitterName);
      emitter.listenerCount++;
      return emitter.value;
    }

    const changeStream = this.getChangeStream(coll);
    const emitter = {
      value: new Emitter(this.database.collection(coll), changeStream, options),
      listenerCount: 1
    };

    emitterName = this.getUniqueEmitterName(coll, options);
    this.emitters.set(emitterName, emitter);

    return emitter.value;
  }

  private findEmitterName(coll: string, options: FindOptions<any>) {
    for (const key of this.emitters.keys()) {
      const emitterOptions = key.includes(coll) ? JSON.parse(key.replace(coll + "_", "")) : false;

      // we have to lose special types like ObjectId, Date in this options in order to compare it with emitterFilter correctly
      const pureOptions = JSON.parse(JSON.stringify(options));
      if (emitterOptions && isEqual(emitterOptions, pureOptions)) {
        return key;
      }
    }

    return undefined;
  }

  removeEmitter(coll: string, options: FindOptions<any>) {
    const emitterName = this.findEmitterName(coll, options);

    if (!emitterName) {
      return console.warn(
        `Connection has already been closed for collection '${coll}' with options '${JSON.stringify(
          options
        )}'.`
      );
    }

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
        changeStream.close();
        this.changeStreams.delete(collName);
      }
    }
  }

  getUniqueEmitterName(coll: string, options: FindOptions<any>) {
    return `${coll}_${JSON.stringify(options)}`;
  }

  find<T extends Document = any>(
    coll: string,
    options: FindOptions<T> = {}
  ): Observable<StreamChunk<T>> {
    return this.getEmitter(coll, options).getObservable();
  }
}
