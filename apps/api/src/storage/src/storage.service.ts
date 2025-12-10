import {BadRequestException, Inject, Injectable, NotFoundException} from "@nestjs/common";
import {
  BaseCollection,
  DatabaseService,
  ObjectId,
  ReturnDocument,
  WithId
} from "@spica-server/database";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {StoragePipelineBuilder} from "./storage-pipeline.builder";
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
import {GuardService} from "@spica-server/passport/guard/services";
import {ForbiddenException} from "@nestjs/common";

@Injectable()
export class StorageService extends BaseCollection<StorageObjectMeta>("storage") {
  constructor(
    database: DatabaseService,
    private service: Strategy,
    private guardService: GuardService,
    @Inject(STORAGE_OPTIONS) private storageOptions: StorageOptions
  ) {
    super(database, {
      afterInit: () => this._coll.createIndex({name: 1}, {unique: true})
    });

    this.service.resumableUploadFinished.subscribe({
      next: async (document: StorageObjectMeta) => {
        try {
          await this._coll.insertOne(document);
        } catch (exception) {
          this.service.delete(document.name);
          throw new BadRequestException(
            exception.code === 11000
              ? "An object with this name already exists."
              : exception.message
          );
        }
      }
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

  async browse(
    resourceFilter: {include?: string[]; exclude?: string[]} | object,
    path: string,
    filter: object,
    limit: number,
    skip: number = 0,
    sort?: any
  ): Promise<StorageResponse[]> {
    const convertedResourceFilter = StoragePipelineBuilder.createResourceFilter(
      resourceFilter as {include?: string[]; exclude?: string[]}
    );

    const pathFilter = StoragePipelineBuilder.createPathFilter(path);

    const pipelineBuilder = (
      await new PipelineBuilder()
        .filterResources(convertedResourceFilter)
        .attachToPipeline(true, {$match: pathFilter})
        .filterByUserRequest(filter)
    ).result();

    const seeking = new PipelineBuilder().sort(sort).skip(skip).limit(limit).result();

    return this._coll
      .aggregate<StorageResponse>([...pipelineBuilder, ...seeking])
      .toArray()
      .then(r => this.putUrls(r));
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

    const folderName = result.name;

    const escapedName = this.escapeRegex(folderName);

    await this._coll.deleteMany({
      name: {$regex: new RegExp(`^${escapedName}`)}
    });
  }
  async deleteManyByIds(ids: ObjectId[]): Promise<void> {
    const objects = await this._coll.find({_id: {$in: ids}}).toArray();
    if (objects.length === 0) {
      return;
    }

    const deletePromises = objects.map(object => this.service.delete(object.name));
    await Promise.all(deletePromises);

    const folderDeletionPromises = objects.map(async object => {
      const escapedName = this.escapeRegex(object.name);
      await this._coll.deleteMany({
        name: {$regex: new RegExp(`^${escapedName}`)}
      });
    });

    await Promise.all(folderDeletionPromises);
  }

  async updateMeta(_id: ObjectId, name: string) {
    const existing = await this._coll.findOne({_id});
    if (!existing) {
      throw new NotFoundException(`Storage object ${_id} could not be found`);
    }

    const oldName = existing.name;

    if (oldName !== name) {
      await this.service.rename(oldName, name);

      const escapedOld = this.escapeRegex(oldName);
      await this._coll.updateMany(
        {
          $or: [{name: oldName}, {name: {$regex: new RegExp(`^${escapedOld}`)}}]
        },
        [
          {
            $set: {
              name: {
                $cond: [
                  {$eq: ["$name", oldName]},
                  name,
                  {
                    $replaceOne: {
                      input: "$name",
                      find: oldName,
                      replacement: name
                    }
                  }
                ]
              }
            }
          }
        ]
      );
    }
    existing.name = name;
    return existing;
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
    object.updated_at = new Date();

    return this._coll.findOneAndUpdate({_id}, {$set: object}).then(() => {
      return {...object, _id: _id};
    });
  }

  async insert(objects: StorageObject<fs.ReadStream | Buffer>[]): Promise<StorageObjectMeta[]> {
    const datas: (Buffer | fs.ReadStream)[] = objects.map(o => o.content.data);
    const now = new Date();
    const schemas: StorageObjectMeta[] = objects.map(object => {
      delete object.content.data;
      object.created_at = now;
      object.updated_at = now;
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

  async getByName(name: string): Promise<WithId<StorageObject<Buffer>>> {
    const object = await this._coll.findOne({name});
    if (!object) return null;

    const objectWithData = object as WithId<StorageObject<Buffer>>;
    objectWithData.content.data = await this.service.read(object.name);
    return objectWithData;
  }

  async getUrl(name: string) {
    return this.service.url(name);
  }

  async handleResumableUpload(req: any, res: any) {
    await this.service.handleResumableUpload(req, res);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async validateDeletePermissions(ids: string[], req: any): Promise<void> {
    let promises = [];
    for (const id of ids) {
      const preparedRequest = {
        ...req,
        route: {path: "/storage/:id"},
        params: {id},
        user: req.user
      };

      const promise = this.guardService.checkAction({
        request: preparedRequest,
        response: {},
        actions: ["storage:delete"],
        options: {resourceFilter: false}
      });
      promises.push(promise);
    }
    await Promise.all(promises);
  }
}
