import {BadRequestException, Inject, Injectable} from "@nestjs/common";
import {
  BaseCollection,
  DatabaseService,
  ObjectId,
  ReturnDocument,
  WithId
} from "@spica-server/database";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {StorageObject, StorageObjectMeta} from "./body";
import {StorageOptions, STORAGE_OPTIONS} from "./options";
import {Strategy} from "./strategy/strategy";
import fs from "fs";

@Injectable()
export class StorageService extends BaseCollection<StorageObjectMeta>("storage") {
  constructor(
    database: DatabaseService,
    private service: Strategy,
    @Inject(STORAGE_OPTIONS) private storageOptions: StorageOptions
  ) {
    super(database, {
      afterInit: () => this._coll.createIndex({name: 1}, {unique: true})
    });
  }

  private existingSize(): Promise<number> {
    return this._coll
      .aggregate([
        {
          $group: {
            _id: "",
            total: {$sum: "$content.size"}
          }
        },
        {
          $project: {total: 1}
        }
      ])
      .toArray()
      .then((d: any) => (d.length ? d[0].total : 0));
  }

  async getStatus() {
    return {
      limit: this.storageOptions.totalSizeLimit,
      current: await this.existingSize().then(bytes =>
        parseFloat((bytes * Math.pow(10, -6)).toFixed(2))
      ),
      unit: "mb"
    };
  }

  private async validateTotalStorageSize(size: number) {
    if (!this.storageOptions.totalSizeLimit) {
      return;
    }
    const existing = await this.existingSize();

    const neededInMb = (existing + size) * Math.pow(10, -6);
    if (neededInMb > this.storageOptions.totalSizeLimit) {
      throw new Error("Total storage object size limit exceeded");
    }
  }

  async getAll<P extends boolean>(
    resourceFilter: object,
    filter: object,
    paginate: P,
    limit: number,
    skip: number,
    sort?: any
  ): Promise<P extends true ? PaginatedStorageResponse : StorageResponse[]>;
  async getAll<P extends boolean>(
    resourceFilter: object,
    filter: object,
    paginate: P,
    limit: number,
    skip: number = 0,
    sort?: any
  ): Promise<PaginatedStorageResponse | StorageResponse[]> {
    let pipelineBuilder = await new PipelineBuilder()
      .filterResources(resourceFilter)
      .filterByUserRequest(filter);

    const seeking = new PipelineBuilder().sort(sort).skip(skip).limit(limit).result();

    const pipeline = (
      await pipelineBuilder.paginate(paginate, seeking, this.estimatedDocumentCount())
    ).result();

    if (paginate) {
      return this._coll
        .aggregate<PaginatedStorageResponse>(pipeline)
        .next()
        .then(async r => {
          if (!r.data.length) {
            r.meta = {total: 0};
          }
          r.data = await this.putUrls(r.data);
          return r;
        });
    }

    return this._coll
      .aggregate<StorageResponse>([...pipeline, ...seeking])
      .toArray()
      .then(r => this.putUrls(r));
  }

  putUrls(objects: StorageResponse[]) {
    const urlPromises = [];
    for (const object of objects) {
      urlPromises.push(this.service.url(object._id.toString()).then(r => (object.url = r)));
    }
    return Promise.all(urlPromises).then(() => objects);
  }

  async get(id: ObjectId): Promise<WithId<StorageObject<Buffer>>> {
    const object = await this._coll.findOne({_id: new ObjectId(id)});
    if (!object) return null;

    const objectWithData = object as WithId<StorageObject<Buffer>>;

    objectWithData.content.data = await this.service.read(id.toHexString());
    return objectWithData;
  }

  async delete(id: ObjectId): Promise<void> {
    const deletedCount = await this._coll.deleteOne({_id: id}).then(res => res.deletedCount);

    if (!deletedCount) {
      return;
    }

    await this.service.delete(id.toHexString());
  }

  async updateMeta(_id: ObjectId, name: string) {
    const existing = await this._coll.findOne({_id});
    if (!existing) {
      throw new Error(`Storage object ${_id} could not be found`);
    }

    return this._coll.findOneAndUpdate(
      {_id},
      {$set: {name}},
      {returnDocument: ReturnDocument.AFTER}
    );
  }

  async update(
    _id: ObjectId,
    object: StorageObject<fs.ReadStream | Buffer>
  ): Promise<StorageObjectMeta> {
    const existing = await this._coll.findOne({_id});
    if (!existing) {
      throw new Error(`Storage object ${_id} could not be found`);
    }

    await this.validateTotalStorageSize(object.content.size - existing.content.size);
    if (object.content.data) {
      await this.write(_id.toString(), object.content.data, object.content.type);
    }

    delete object.content.data;
    delete object._id;

    return this._coll.findOneAndUpdate({_id}, {$set: object}).then(() => {
      return {...object, _id: _id};
    });
  }

  async insert(objects: StorageObject<fs.ReadStream | Buffer>[]): Promise<StorageObjectMeta[]> {
    const datas: (Buffer | fs.ReadStream)[] = objects.map(o => o.content.data);
    const schemas: StorageObjectMeta[] = objects.map(object => {
      delete object.content.data;
      return object;
    });

    await this.validateTotalStorageSize(schemas.reduce((sum, curr) => sum + curr.content.size, 0));

    let insertedObjects: StorageObjectMeta[];

    try {
      insertedObjects = await this._coll
        .insertMany(schemas)
        .then(result => schemas.map((s, i) => ({...s, _id: result.insertedIds[i]})));
    } catch (exception) {
      throw new BadRequestException(
        exception.code === 11000 ? "An object with this name already exists." : exception.message
      );
    }

    for (const [i, object] of insertedObjects.entries()) {
      try {
        await this.write(object._id.toString(), datas[i], object.content.type);
      } catch (error) {
        const idsToDelete = insertedObjects.slice(i).map(o => o._id);
        await this._coll.deleteMany({_id: {$in: idsToDelete}});

        throw new Error(
          `Error: Failed to write object ${object.name} to storage. Reason: ${error}`
        );
      }
    }

    return insertedObjects;
  }

  private write(_id: string, data: fs.ReadStream | Buffer, type: string) {
    if (data instanceof Buffer) {
      return this.service.write(_id.toString(), data, type);
    } else {
      return this.service.writeStream(_id.toString(), data as fs.ReadStream, type);
    }
  }

  async getUrl(id: string) {
    return this.service.url(id);
  }
}

export type StorageResponse = StorageObjectMeta;

export interface PaginatedStorageResponse {
  meta: {
    total: number;
  };
  data: StorageResponse[];
}
