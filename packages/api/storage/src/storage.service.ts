import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import {
  StorageOptions,
  StorageObject,
  StorageObjectMeta,
  STORAGE_OPTIONS,
  STORAGE_REPOSITORY,
  StorageRepository,
  StorageResponse,
  PaginatedStorageResponse
} from "@spica-server/interface-storage";
import {Strategy, ProxyReadResult} from "./strategy/strategy.js";
import {TransactionExecutor} from "@spica-server/transaction";

import fs from "fs";
import {DuplicateKeyError, ids} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";

const storageIds = () => ids().forCollection("storage");

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_REPOSITORY) private objects: StorageRepository,
    private service: Strategy,
    @Inject(STORAGE_OPTIONS) private storageOptions: StorageOptions,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {
    this.service.resumableUploadFinished.subscribe({
      next: async (document: StorageObjectMeta) => {
        try {
          await this.objects.insert(document);
        } catch (exception) {
          this.service.delete(document.name);
          throw new BadRequestException(
            exception instanceof DuplicateKeyError
              ? "An object with this name already exists."
              : exception.message
          );
        }
      }
    });
  }

  private existingSize(): Promise<number> {
    return this.objects.totalSize();
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
    return this.objects
      .browse({resourceFilter, path, filter, sort, skip, limit})
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
    const spec = {resourceFilter, filter, sort, skip, limit};

    if (paginate) {
      return this.queries
        .paginate<StorageResponse>("storage", spec, "estimate-unless-filtered")
        .then(async r => {
          r.data = await this.putUrls(r.data);
          return r as PaginatedStorageResponse;
        });
    }

    return this.queries.find<StorageResponse>("storage", spec).then(r => this.putUrls(r));
  }

  putUrls(objects: StorageResponse[]) {
    const urlPromises = [];
    for (const object of objects) {
      const fileName = object.name;
      urlPromises.push(this.service.url(fileName).then(r => (object.url = r)));
    }
    return Promise.all(urlPromises).then(() => objects);
  }

  async get(id: Id): Promise<StorageObject<Buffer>> {
    const object = await this.objects.findById(storageIds().parse(id));
    if (!object) return null;

    const objectWithData = object as StorageObject<Buffer>;
    objectWithData.content.data = await this.service.read(object.name);
    return objectWithData;
  }

  async delete(idOrName: Id | string): Promise<void> {
    const result = storageIds().is(idOrName)
      ? await this.objects.deleteById(idOrName)
      : await this.objects.deleteByName(idOrName as string);

    if (!result) {
      throw new NotFoundException(`Storage object could not be found`);
    }

    // rollback will cost much, in fact api could crash, best-effort deletion is enough, so we do not use transaction here
    try {
      await this.service.delete(result.name);

      const children = await this.objects.findByNamePrefix(result.name);
      await Promise.allSettled(children.map(child => this.service.delete(child.name)));

      await this.objects.deleteByNamePrefix(result.name);
    } catch (error) {
      this.logger.error(
        `Failed to delete storage object ${result.name} from storage:`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  async deleteManyByIds(ids: Id[]): Promise<void> {
    const objects = await this.objects.findByIds(ids);
    if (objects.length === 0) {
      return;
    }

    // rollback will cost much, in fact api could crash, best-effort deletion is enough, so we do not use transaction here
    try {
      const deletePromises = objects.map(object => this.service.delete(object.name));
      await Promise.all(deletePromises);

      const folderDeletionPromises = objects.map(async object => {
        const children = await this.objects.findByNamePrefix(object.name);
        await Promise.allSettled(children.map(child => this.service.delete(child.name)));

        await this.objects.deleteByNamePrefix(object.name);
      });

      await Promise.all(folderDeletionPromises);
    } catch (error) {
      this.logger.error(
        `Failed to delete storage objects from storage:`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  async updateMeta(_id: Id, name: string) {
    const existing = await this.objects.findById(_id);
    if (!existing) {
      throw new NotFoundException(`Storage object ${_id} could not be found`);
    }

    const oldName = existing.name;

    if (oldName !== name) {
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
          await this.objects.renamePrefix(oldName, name);
        },
        rollback: async () => {
          await this.objects.renamePrefix(name, oldName);
        }
      });

      await tx.execute();
    }
    existing.name = name;
    return existing;
  }

  async update(_id: Id, object: StorageObject<fs.ReadStream | Buffer>): Promise<StorageObjectMeta> {
    const existing = await this.objects.findById(_id);
    if (!existing) {
      throw new NotFoundException(`Storage object ${_id} could not be found`);
    }

    await this.validateTotalStorageSize(object.content.size - existing.content.size);

    const oldName = existing.name;
    const newName = object.name;

    try {
      if (object.content.data) {
        if (oldName !== newName) {
          // rollback will cost much, in fact api could crash, best-effort deletion is enough, so we do not use transaction here
          this.service.delete(oldName);
        }
        await this.write(newName, object.content.data, object.content.type);
      }

      delete object.content.data;
      delete object._id;
      object.updated_at = new Date();

      return this.objects.updateById(_id, object).then(() => {
        return {...object, _id: _id};
      });
    } catch (error) {
      this.logger.error(
        `Failed to update storage object ${existing.name} in storage:`,
        error instanceof Error ? error.stack : String(error)
      );
    }
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
          insertedObjects = await this.objects.insertAll(schemas);
        } catch (exception) {
          throw new BadRequestException(
            exception instanceof DuplicateKeyError
              ? "An object with this name already exists."
              : exception.message
          );
        }
      },
      rollback: async () => {
        if (insertedObjects) {
          const idsToDelete = insertedObjects.map(o => o._id as Id);
          await this.objects.deleteByIds(idsToDelete);
        }
      }
    });

    for (let i = 0; i < objects.length; i++) {
      tx.add({
        execute: async () => {
          try {
            await this.write(insertedObjects[i].name, datas[i], insertedObjects[i].content.type);
          } catch (error) {
            throw new Error(
              `Error: Failed to write object ${insertedObjects[i].name} to storage. Reason: ${error}`
            );
          }
        },
        rollback: async () => {
          await this.service.delete(insertedObjects[i].name);
        }
      });
    }

    await tx.execute();

    return insertedObjects;
  }

  private write(name: string, data: fs.ReadStream | Buffer, type: string) {
    if (data instanceof Buffer) {
      return this.service.write(name, data, type);
    } else {
      return this.service.writeStream(name, data as fs.ReadStream, type);
    }
  }

  async getByName(name: string): Promise<StorageObject<Buffer>> {
    const object = await this.objects.findByName(name);
    if (!object) return null;

    const objectWithData = object as StorageObject<Buffer>;
    objectWithData.content.data = await this.service.read(object.name);
    return objectWithData;
  }

  private getMeta(idOrName: Id | string): Promise<StorageObjectMeta | null> {
    return storageIds().is(idOrName)
      ? this.objects.findById(storageIds().parse(idOrName))
      : this.objects.findByName(idOrName as string);
  }

  async proxyRead(
    idOrName: Id | string,
    requestHeaders: Record<string, string>
  ): Promise<ProxyReadResult> {
    const meta = await this.getMeta(idOrName);
    if (!meta) {
      throw new NotFoundException(`Storage object could not be found`);
    }
    return this.service.proxyRead(meta.name, requestHeaders, meta);
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

  findByNames(names: string[]): Promise<StorageObjectMeta[]> {
    return this.objects.findByNames(names);
  }
}
