import {BadRequestException, Inject, Injectable, NotFoundException} from "@nestjs/common";
import {
  BaseCollection,
  DatabaseService,
  ObjectId,
  ReturnDocument,
  WithId
} from "@spica-server/database";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {
  StorageOptions,
  StorageObject,
  StorageObjectMeta,
  STORAGE_OPTIONS,
  StorageResponse,
  PaginatedStorageResponse
} from "@spica-server/interface/storage";
import {Strategy} from "./strategy/strategy";
import fs from "fs";
import {Server, EVENTS} from "@tus/server";
import {CronJob} from "cron";

@Injectable()
export class StorageService extends BaseCollection<StorageObjectMeta>("storage") {
  private tusServer: Server;

  constructor(
    database: DatabaseService,
    private service: Strategy,
    @Inject(STORAGE_OPTIONS) private storageOptions: StorageOptions
  ) {
    super(database, {
      afterInit: () => this._coll.createIndex({name: 1}, {unique: true})
    });

    this.initializeTusServer();
  }

  private initializeTusServer() {
    this.tusServer = new Server({
      path: "/storage/resumable",
      datastore: this.service.getTusServerDatastore()
    });

    this.tusServer.on(EVENTS.POST_FINISH, this.onFileUploaded.bind(this));

    const cleanUpExpiredUploads = this.service.getCleanUpExpiredUploadsMethod();
    if (cleanUpExpiredUploads) {
      this.tusServer.cleanUpExpiredUploads = cleanUpExpiredUploads;
    }

    new CronJob(
      "0 0 * * *",
      () => {
        this.tusServer.cleanUpExpiredUploads();
      },
      null,
      true
    );
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
      const fileName = object.name;
      urlPromises.push(this.service.url(fileName).then(r => (object.url = r)));
    }
    return Promise.all(urlPromises).then(() => objects);
  }

  async get(id: ObjectId): Promise<WithId<StorageObject<Buffer>>> {
    const object = await this._coll.findOne({_id: new ObjectId(id)});
    if (!object) return null;

    const objectWithData = object as WithId<StorageObject<Buffer>>;
    objectWithData.content.data = await this.service.read(object.name);
    return objectWithData;
  }

  async delete(id: ObjectId): Promise<void> {
    const result = await this._coll.findOneAndDelete({_id: id});

    if (!result) {
      throw new NotFoundException(`Storage object could not be found`);
    }

    await this.service.delete(result.name);
  }

  async updateMeta(_id: ObjectId, name: string) {
    const existing = await this._coll.findOne({_id});
    if (!existing) {
      throw new NotFoundException(`Storage object ${_id} could not be found`);
    }

    const oldName = existing.name;

    if (oldName !== name) {
      await this.service.rename(oldName, name);
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
      throw new NotFoundException(`Storage object ${_id} could not be found`);
    }

    await this.validateTotalStorageSize(object.content.size - existing.content.size);

    const oldName = existing.name;
    const newName = object.name;

    if (object.content.data) {
      if (oldName !== newName) {
        this.service.delete(oldName);
      }
      await this.write(newName, object.content.data, object.content.type);
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
        await this.write(object.name, datas[i], object.content.type);
      } catch (error) {
        const idsToDelete = insertedObjects.map(o => o._id);
        await this._coll.deleteMany({_id: {$in: idsToDelete}});
        const namesToDelete = insertedObjects.map(o => o.name);

        const deletePromises = [];
        namesToDelete.slice(0, i).forEach(name => {
          deletePromises.push(this.service.delete(name));
        });
        await Promise.all(deletePromises);

        throw new Error(
          `Error: Failed to write object ${object.name} to storage. Reason: ${error}`
        );
      }
    }

    return insertedObjects;
  }

  private write(name: string, data: fs.ReadStream | Buffer, type: string) {
    if (data instanceof Buffer) {
      return this.service.write(name, data, type);
    } else {
      return this.service.writeStream(name, data as fs.ReadStream, type);
    }
  }

  async getUrl(name: string) {
    return this.service.url(name);
  }

  async handleResumableUpload(req: any, res: any) {
    await this.tusServer.handle(req, res);
  }

  async onFileUploaded(event) {
    const fileId = event.url.split("/").pop();

    const info = await this.tusServer.datastore.getUpload(fileId);
    const finename = info.metadata.filename;

    await this.service.rename(fileId, finename);

    const document = {
      name: finename,
      content: {
        type: info.metadata.filetype,
        size: info.size
      }
    };

    try {
      await this._coll.insertOne(document);
    } catch (exception) {
      this.service.delete(finename);

      throw new BadRequestException(
        exception.code === 11000 ? "An object with this name already exists." : exception.message
      );
    }
  }
}
