import {BreakpointObserver, Breakpoints, BreakpointState} from "@angular/cdk/layout";
import {HttpEventType} from "@angular/common/http";
import {Component, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {
  merge,
  Observable,
  BehaviorSubject,
  Subject,
  of,
  combineLatest,
  Subscription,
  generate
} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
import {ImageEditorComponent} from "../../components/image-editor/image-editor.component";
import {StorageDialogOverviewDialog} from "../../components/storage-dialog-overview/storage-dialog-overview";
import {Storage, StorageTree} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";

@Component({
  selector: "storage-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  subscription: Subscription;

  storages: StorageTree[] = [];
  progress: number;

  updates: Map<string, number> = new Map<string, number>();

  refresh: Subject<string> = new BehaviorSubject("");
  sorter: any = {_id: -1};
  cols: number = 5;

  loading$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  lastUpdates: Map<string, number> = new Map();

  isEmpty = true;

  selectedStorageIds = [];

  selectionActive = false;

  selectedStorage: StorageTree;

  //prettier-ignore
  baseFilter = {name:{$regex:'/^\/[^\/]+\/$|^[^\/]+\/$|^[^\/]+$'}}
  filter$ = new BehaviorSubject(this.baseFilter);

  constructor(
    private storage: StorageService,
    public breakpointObserver: BreakpointObserver,
    public dialog: MatDialog
  ) {
    this.breakpointObserver
      .observe([
        Breakpoints.XSmall,
        Breakpoints.XLarge,
        Breakpoints.Large,
        Breakpoints.Medium,
        Breakpoints.Small
      ])
      .subscribe((state: BreakpointState) => {
        this.breakpointObserver.isMatched(Breakpoints.XSmall)
          ? (this.cols = 2)
          : this.breakpointObserver.isMatched(Breakpoints.Small)
          ? (this.cols = 3)
          : this.breakpointObserver.isMatched(Breakpoints.Medium)
          ? (this.cols = 4)
          : (this.cols = 5);
      });
  }

  selectAll(storages: Storage[]) {
    this.selectedStorageIds = storages.map(storage => storage._id);
  }

  ngOnInit(): void {
    this.subscription = combineLatest([this.refresh, this.filter$])
      .pipe(
        tap(() => this.loading$.next(true)),
        switchMap(([_, filter]) => this.storage.getAll(filter, undefined, undefined, this.sorter)),
        map(storages => (this.storages = this.mapObjectsToTree(storages))),
        tap(() => {
          if (this.selectedStorage) {
            this.setSelecteds(this.getFullName(this.selectedStorage), this.storages);
          }
        }),
        tap(() => this.loading$.next(false))
      )
      .subscribe(storages => (this.storages = storages));
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  uploadStorageMany(file: FileList): void {
    if (file.length) {
      this.storage.insertMany(file).subscribe(
        event => {
          if (event.type === HttpEventType.UploadProgress) {
            this.progress = Math.round((100 * event.loaded) / event.total);
          } else if (event.type === HttpEventType.Response) {
            this.progress = undefined;
            this.refresh.next();
          }
        },
        err => {
          console.error(err);
          this.progress = undefined;
        }
      );
    }
  }

  updateStorage(storage: Storage, file: File) {
    if (file) {
      this.updates.set(storage._id, 0);
      storage.name = file.name;
      this.storage.updateOne(storage, file).subscribe(
        event => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = Math.round((100 * event.loaded) / event.total);
            this.updates.set(storage._id, progress);
          } else if (event.type === HttpEventType.Response) {
            this.updates.delete(storage._id);
            this.refresh.next();
          }
        },
        err => {
          console.error(err);
          this.updates.delete(storage._id);
        },
        () => this.updates.delete(storage._id)
      );
    }
  }

  clearLastUpdates() {
    this.lastUpdates.clear();
    this.refresh.next();
  }

  delete(id: string): void {
    this.storage
      .delete(id)
      .toPromise()
      .catch()
      .then(() => this.refresh.next());
  }

  deleteMany() {
    const promises = this.selectedStorageIds.map(id => this.storage.delete(id).toPromise());
    return Promise.all(promises).then(() => this.refresh.next());
  }

  sortStorage(value) {
    value.direction = value.direction === "asc" ? 1 : -1;
    this.sorter = {[value.name]: value.direction};
    this.refresh.next();
  }

  openPreview(storage: Storage): void {
    this.dialog.open(StorageDialogOverviewDialog, {
      maxWidth: "80%",
      maxHeight: "80%",
      panelClass: "preview-object",
      data: storage
    });
  }

  openEdit(storage: Storage): void {
    this.dialog
      .open(ImageEditorComponent, {
        maxWidth: "80%",
        maxHeight: "80%",
        panelClass: "edit-object",
        data: storage
      })
      .afterClosed()
      .toPromise()
      .then(() => this.refresh.next());
  }

  addFolder(name: string) {
    const folder = new File([], name);
    this.storage.insertMany([folder] as any).toPromise();
  }

  mapObjectsToTree(objects: (StorageTree | Storage)[]) {
    let result: StorageTree[] = [];

    const mapPath = (obj: Storage, compare: StorageTree[], parent: StorageTree, depth: number) => {
      const parts = obj.name.split("/").filter(p => p != "");
      const root = parts[0];

      const doesNotExist = !compare.some(c => c.name == root);
      if (doesNotExist) {
        compare.push({
          name: root,
          children: [],
          parent,
          depth,
          isDirectory: false,
          isSelected: false
        });
      }

      const newParent = compare.find(c => c.name == root);
      const newCompare = newParent.children;
      const newObj = {
        name: parts.slice(1, parts.length).join("/"),
        content: obj.content
      };

      depth++;

      newParent.isDirectory = this.isDirectory(obj);

      const hasChild = newObj.name != "";
      if (hasChild) {
        mapPath(newObj, newCompare, newParent, depth);
      } else {
        newParent.content = obj.content;
      }
      newParent.children = newParent.children.sort((a, b) => a.name.localeCompare(b.name));
    };

    for (let object of objects) {
      mapPath(object, result, undefined, 1);
    }

    return result;
  }

  // onStorageSelect(selected: StorageTree) {
  //   console.log(selected);
  //   if (this.isDirectory(selected)) {
  //     const fullName = this.getFullName(selected);
  //     this.resetNeighborsChildren(fullName)
  //   }
  // }

  // getFullName(storage: StorageTree, suffix?: string) {
  //   const newName = suffix ? `${storage.name}/${suffix}` : storage.name;
  //   if (storage.parent) {
  //     this.getFullName(storage.parent, newName);
  //   } else {
  //     return newName;
  //   }
  // }

  // resetNeighborsChildren(fullName:string){
  //   const find = (name,storages) => {return }
  // }

  onStorageSelect(storage: StorageTree) {
    this.selectedStorage = storage;

    const fullName = this.getFullName(storage);
    this.setSelecteds(fullName, this.storages);

    const filter = this.generateFilterByFullName(fullName);
    this.filter$.next(filter as any);
  }

  setSelecteds(fullName: string, tree: StorageTree[]) {
    tree.forEach(t => (t.isSelected = false));
    const parts = fullName.split("/").filter(n => n != "");
    const name = parts[0];

    const targetNode = tree.find(t => t.name == name);
    targetNode.isSelected = true;

    if (parts.length > 1) {
      this.setSelecteds(parts.slice(1, parts.length).join("/"), targetNode.children);
    }

    return;
  }

  isDirectory(storage: StorageTree | Storage) {
    return storage.content.size == 0 && storage.content.type == "";
  }

  generateFilterByFullName(fullName: string) {
    const parts = fullName.split("/").filter(n => n != "");

    const generateFilterByName = name => {
      return {name: {$regex: `^${name}\/[^\/]+\/?$`}};
    };

    const filters = [this.baseFilter];

    let endIndex = 1;
    while (true) {
      const name = parts.slice(0, endIndex).join("/");
      const filter = generateFilterByName(name);
      filters.push(filter);
      endIndex++;
      if (endIndex > parts.length) {
        break;
      }
    }

    return {$or: filters};
  }

  getFullName(storage: StorageTree, suffix?: string) {
    const newName = suffix ? `${storage.name}/${suffix}` : storage.name;
    if (storage.parent) {
      return this.getFullName(storage.parent, newName);
    } else {
      return newName;
    }
  }
}
