import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
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
import {TransactionExecutor} from "@spica-server/transaction";

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
      throw new BadRequestException("Total storage object size limit exceeded");
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

  async delete(idOrName: ObjectId | string): Promise<void> {
    const query = idOrName instanceof ObjectId ? {_id: idOrName} : {name: idOrName};
    const existing = await this._coll.findOne(query);

    if (!existing) {
      throw new NotFoundException(`Storage object could not be found`);
    }

    const deletedDoc = {...existing};
    const folderName = existing.name;
    const escapedName = this.escapeRegex(folderName);
    let deletedSubDocs: any[] = [];

    const tx = new TransactionExecutor();

    tx.add({
      execute: async () => {
        await this._coll.findOneAndDelete(query);
      },
      rollback: async () => {
        await this._coll.insertOne(deletedDoc);
      }
    });

    tx.add({
      execute: async () => {
        await this.service.delete(existing.name);
      },
      rollback: async () => {
        // Cannot restore deleted content from strategy — best-effort
      }
    });

    tx.add({
      execute: async () => {
        const subDocs = await this._coll
          .find({name: {$regex: new RegExp(`^${escapedName}`)}})
          .toArray();
        deletedSubDocs = subDocs;
        if (subDocs.length > 0) {
          await this._coll.deleteMany({
            name: {$regex: new RegExp(`^${escapedName}`)}
          });
        }
      },
      rollback: async () => {
        if (deletedSubDocs.length > 0) {
          await this._coll.insertMany(deletedSubDocs);
        }
      }
    });

    await tx.execute();
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
      const escapedOld = this.escapeRegex(oldName);
      const tx = new TransactionExecutor();

      tx.add({
        execute: async () => {
          await this.service.rename(oldName, name);
        },
        rollback: async () => {
          await this.service.rename(name, oldName);
        }
      });

      tx.add({
        execute: async () => {
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
        },
        rollback: async () => {
          const escapedNew = this.escapeRegex(name);
          await this._coll.updateMany(
            {
              $or: [{name: name}, {name: {$regex: new RegExp(`^${escapedNew}`)}}]
            },
            [
              {
                $set: {
                  name: {
                    $cond: [
                      {$eq: ["$name", name]},
                      oldName,
                      {
                        $replaceOne: {
                          input: "$name",
                          find: name,
                          replacement: oldName
                        }
                      }
                    ]
                  }
                }
              }
            ]
          );
        }
      });

      await tx.execute();
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
    const contentData = object.content.data;

    const tx = new TransactionExecutor();

    if (contentData) {
      // Read old content before mutation so we can restore on rollback
      let oldContent: Buffer | undefined;
      try {
        oldContent = await this.service.read(oldName);
      } catch {
        // Old content may not exist yet
      }

      tx.add({
        execute: async () => {
          await this.write(newName, contentData, object.content.type);
        },
        rollback: async () => {
          // Restore old content to undo the overwrite
          if (oldContent) {
            await this.service.write(oldName, oldContent, existing.content.type);
          }
          // Remove newly written file if names differ
          if (oldName !== newName) {
            try {
              await this.service.delete(newName);
            } catch {
              // Best-effort cleanup
            }
          }
        }
      });

      if (oldName !== newName) {
        tx.add({
          execute: async () => {
            await this.service.delete(oldName);
          },
          rollback: async () => {
            if (oldContent) {
              await this.service.write(oldName, oldContent, existing.content.type);
            }
          }
        });
      }
    }

    delete object.content.data;
    delete object._id;
    object.updated_at = new Date();

    const existingSnapshot = {...existing};
    tx.add({
      execute: async () => {
        await this._coll.findOneAndUpdate({_id}, {$set: object});
      },
      rollback: async () => {
        const {_id: docId, ...rest} = existingSnapshot;
        await this._coll.findOneAndUpdate({_id}, {$set: rest});
      }
    });

    await tx.execute();

    return {...object, _id: _id};
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

    const tx = new TransactionExecutor();

    tx.add({
      execute: async () => {
        try {
          insertedObjects = await this._coll
            .insertMany(schemas)
            .then(result => schemas.map((s, i) => ({...s, _id: result.insertedIds[i]})));
        } catch (exception) {
          throw new BadRequestException(
            exception.code === 11000
              ? "An object with this name already exists."
              : exception.message
          );
        }
      },
      rollback: async () => {
        if (insertedObjects) {
          const idsToDelete = insertedObjects.map(o => o._id);
          await this._coll.deleteMany({_id: {$in: idsToDelete}});
        }
      }
    });

    // Each file write is a separate step so rollback cleans up written files
    for (let i = 0; i < objects.length; i++) {
      tx.add({
        execute: async () => {
          await this.write(insertedObjects[i].name, datas[i], insertedObjects[i].content.type);
        },
        rollback: async () => {
          try {
            await this.service.delete(insertedObjects[i].name);
          } catch {
            // Best-effort cleanup
          }
        }
      });
    }

    try {
      await tx.execute();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const failedName = insertedObjects
        ? insertedObjects.find((_, idx) => idx < objects.length)?.name
        : "unknown";
      throw new Error(
        `Error: Failed to write object to storage. Reason: ${error.message || error}`
      );
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
    const uploadLength = req.headers["upload-length"];
    if (uploadLength) {
      const size = this.parseUploadLength(uploadLength);
      await this.validateTotalStorageSize(size);
    }
    await this.service.handleResumableUpload(req, res);
  }

  private parseUploadLength(value: number): number {
    const size = Number(value);

    if (!Number.isFinite(size) || !Number.isInteger(size) || size < 0) {
      throw new BadRequestException("Invalid Upload-Length header");
    }

    return size;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
