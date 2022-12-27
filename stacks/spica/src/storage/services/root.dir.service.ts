import {Injectable} from "@angular/core";
import {StorageService} from "./storage.service";
import {Filters} from "../helpers";
import {Observable, Subscriber} from "rxjs";
import {Storage} from "../interfaces/storage";
import {HttpEventType} from "@angular/common/http";

// somehow, our reducer that uses ngrx to store resources didn't work for this module.
// I had to implement this way, but we should consider using ngrx store just like other modules use.
@Injectable({providedIn: "root"})
export class RootDirService {
  storages: Storage[] = [];

  subscribers: Subscriber<Storage[]>[] = [];

  constructor(private storageService: StorageService) {}

  watch() {
    return new Observable<Storage[]>(subscriber => {
      this.subscribers.push(subscriber);
      this.findAll().then(storages => {
        this.storages = storages;
        subscriber.next(this.storages);
      });
    });
  }

  private onChange() {
    this.findAll().then(storages => {
      this.storages = storages;
      this.subscribers.forEach(s => s.next(this.storages));
    });
  }

  add(name: string) {
    name = name.endsWith("/") ? name : `${name}/`;
    const dir = new File([], name);

    return new Observable(subscriber => {
      this.storageService.insertMany([dir] as any).subscribe(r => {
        if (r.type == HttpEventType.Response) {
          this.onChange();
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

    return Promise.all(promises).then(() => this.onChange());
  }

  findAll() {
    return this.storageService.getAll({filter: Filters.ListRootDirs}).toPromise();
  }
}
