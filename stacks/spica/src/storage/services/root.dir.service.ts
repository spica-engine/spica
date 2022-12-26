import {Injectable} from "@angular/core";
import {StorageService} from "./storage.service";
import {tap} from "rxjs/operators";
import {listRootDirsRegex} from "../helpers";
import {Observable, Subscriber} from "rxjs";
import {Storage} from "../interfaces/storage";
import {HttpEventType} from "@angular/common/http";

// somehow, our reducer that use ngrx to store resources didn't work for this module.
// I had to implement this custom way, but we should consider using ngrx store just like other modules use.
@Injectable({providedIn: "root"})
export class RootDirService {
  storages: Storage[] = [];

  subscriber: Subscriber<Storage[]>;
  observable: Observable<Storage[]>;

  constructor(private storageService: StorageService) {}

  findAll() {
    if (!this.observable) {
      this.observable = new Observable<Storage[]>(subscriber => {
        this.subscriber = subscriber;
        subscriber.next(this.storages);
      });
    }

    return this.observable;
  }

  add(name: string) {
    name = name.endsWith("/") ? name : `${name}/`;
    const dir = new File([], name);

    return new Observable(subscriber => {
      this.storageService.insertMany([dir] as any).subscribe(async r => {
        if (r.type == HttpEventType.Response) {
          await this.retrieve();
          subscriber.complete();
        }
      });
    });
  }

  async delete(name: string) {
    const regex = `^${name}/`;
    const filter = {name: {$regex: regex}};

    const storages = await this.storageService.getAll({filter}).toPromise();
    const promises = storages.map(s => this.storageService.delete(s._id).toPromise());

    return Promise.all(promises).then(() => this.retrieve());
  }

  retrieve() {
    return this.storageService
      .getAll({filter: {name: {$regex: listRootDirsRegex}}})
      .pipe(
        tap(dirs => (this.storages = dirs)),
        tap(() => this.subscriber.next(this.storages))
      )
      .toPromise();
  }
}
