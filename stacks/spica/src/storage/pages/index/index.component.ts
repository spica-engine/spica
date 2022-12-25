import {BreakpointObserver, Breakpoints, BreakpointState} from "@angular/cdk/layout";
import {HttpEventType} from "@angular/common/http";
import {Component, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {ActivatedRoute, Router} from "@angular/router";
import {AddDirectoryDialog} from "@spica-client/storage/components/add-directory-dialog/add-directory-dialog.component";
import {
  findNodeById,
  getFullName,
  isDirectory,
  listDirectoriesRegex
} from "@spica-client/storage/helpers";
import {RootDirService} from "@spica-client/storage/services/root.dir.service";
import {BehaviorSubject, Subject, combineLatest, Subscription, of} from "rxjs";
import {filter, map, switchMap, tap} from "rxjs/operators";
import {ImageEditorComponent} from "../../components/image-editor/image-editor.component";
import {StorageDialogOverviewDialog} from "../../components/storage-dialog-overview/storage-dialog-overview";
import {Storage, StorageNode} from "../../interfaces/storage";
import {StorageService} from "../../services/storage.service";

@Component({
  selector: "storage-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  subscriptions: Subscription[] = [];

  storages: StorageNode[] = [];
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

  currentStorage: StorageNode;

  root: string;

  filter$ = new Subject<object>();

  renamingStorage: StorageNode;

  constructor(
    private storage: StorageService,
    private rootDirService: RootDirService,
    public breakpointObserver: BreakpointObserver,
    public dialog: MatDialog,
    private route: ActivatedRoute,
    private router: Router
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

  selectAll(storage: StorageNode) {
    const target = storage.isDirectory ? storage : storage.parent;
    this.selectedStorageIds = target.children.map(storage => storage._id);
  }

  ngOnInit(): void {
    const storagesSubs = combineLatest([this.refresh, this.filter$])
      .pipe(
        tap(() => this.loading$.next(true)),
        switchMap(([_, filter]) => this.storage.getAll(filter, undefined, undefined, this.sorter)),
        map(storages => (this.storages = this.mapObjectsToNodes(storages))),
        tap(() => {
          this.currentStorage = this.currentStorage || this.storages[0];
          this.setHighlighteds(getFullName(this.currentStorage), this.storages);
        }),
        tap(() => this.loading$.next(false))
      )
      .subscribe();

    const routeSubs = this.route.params
      .pipe(
        tap(params => {
          if (!params.name) {
            this.root = undefined;
            this.addRootDir();
            return;
          }
        }),
        filter(params => params.name),
        map(params => params.name)
      )
      .subscribe(name => {
        this.currentStorage = undefined;

        this.root = name;

        const filter = this.buildFilterByFullName(this.root);
        this.filter$.next(filter);
      });

    this.subscriptions.push(storagesSubs, routeSubs);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  getCurrentFolder() {
    return this.currentStorage.isDirectory ? this.currentStorage : this.currentStorage.parent;
  }

  getCurrentDirName() {
    const target = this.currentStorage.isDirectory
      ? this.currentStorage
      : this.currentStorage.parent;

    return getFullName(target);
  }

  uploadStorageMany(file: FileList): void {
    if (file.length) {
      const prefix = this.getCurrentDirName();
      this.storage.insertMany(file, prefix).subscribe(
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

  updateStorage(node: StorageNode, file: File) {
    if (file) {
      const parentFullName = getFullName(node.parent);
      const storage = this.mapNodesToObjects([node])[0];
      storage.name = `${parentFullName}/${file.name}`;

      this.updates.set(storage._id, 0);

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

  delete(id: string) {
    return this.storage
      .delete(id)
      .toPromise()
      .then(() => {
        this.currentStorage = this.currentStorage.parent;
        this.refresh.next();
      });
  }

  deleteDir() {
    return this.rootDirService.delete(this.root).then(() => this.refresh.next());
  }

  async deleteMany(ids: string[]) {
    const findShallowestDeletedStorage = (storage: StorageNode, _ids: string[]) => {
      const hasSelectedParent = storage.parent && _ids.includes(storage.parent._id);
      return hasSelectedParent ? findShallowestDeletedStorage(storage.parent, _ids) : storage;
    };

    const idsWillBeDeleted = new Set<string>();

    const idsPromises = [];

    for (const id of ids) {
      const storage = findNodeById(id, this.storages);
      const shallowestDeletedStorage = findShallowestDeletedStorage(storage, ids);
      if (shallowestDeletedStorage.isDirectory) {
        const fullName = getFullName(shallowestDeletedStorage);
        idsPromises.push(
          this.storage
            .listSubResources(fullName)
            .then(storages => storages.forEach(s => idsWillBeDeleted.add(s._id)))
        );
      } else {
        idsWillBeDeleted.add(storage._id);
      }
    }

    await Promise.all(idsPromises);
    await Promise.all(Array.from(idsWillBeDeleted).map(id => this.storage.delete(id).toPromise()));
    this.refresh.next();
  }

  // deleteMany(ids: string[]) {
  //   const storages = [];
  //   for(const id of ids){
  //     this.storage.getAll()
  //   }

  //   return this.storage
  //     .listObjectsUnderIds(ids, this.storages)
  //     .then(objects => Promise.all(objects.map(o => this.storage.delete(o._id).toPromise())))
  //     .then(() => this.refresh.next());
  // }

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

  addDirectory(name: string) {
    const dir = new File([], name);
    return this.storage
      .insertMany([dir] as any)
      .toPromise()
      .then(() => this.refresh.next());
  }

  mapNodesToObjects(nodes: StorageNode[]) {
    nodes.forEach(node => {
      node.name = getFullName(node);
      delete node.parent;
      delete node.children;
      delete node.depth;
      delete node.isDirectory;
      delete node.isHighlighted;
    });

    return nodes;
  }

  mapObjectsToNodes(objects: (StorageNode | Storage)[]) {
    let result: StorageNode[] = [];

    const mapPath = (obj: Storage, compare: StorageNode[], parent: StorageNode, depth: number) => {
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
          isHighlighted: false
        });
      }

      depth++;

      const currentNode = compare.find(c => c.name == root);
      const newObj: any = {
        name: parts.slice(1, parts.length).join("/")
      };

      const hasChild = newObj.name != "";
      if (hasChild) {
        newObj.content = obj.content;
        newObj.url = obj.url;
        newObj._id = obj._id;
        newObj.isSubDirectory = isDirectory(obj);
        mapPath(newObj, currentNode.children, currentNode, depth);
      } else {
        currentNode.content = obj.content;
        currentNode.url = obj.url;
        currentNode._id = obj._id;
        currentNode.isDirectory = isDirectory(obj);
      }
    };

    for (let object of objects) {
      mapPath(object, result, undefined, 1);
    }

    return result;
  }

  onStorageHighlighted(storage: StorageNode) {
    this.currentStorage = storage;

    const fullName = getFullName(storage);

    if (!storage.isDirectory) {
      return this.setHighlighteds(fullName, this.storages);
    }

    const filter = this.buildFilterByFullName(fullName);
    this.filter$.next(filter);
  }

  onDetailsClosed(storage: StorageNode) {
    const fullName = getFullName(storage);

    const parentNameParts = fullName.split("/").filter(n => n != "");
    parentNameParts.pop();

    if (!parentNameParts.length) {
      this.clearHighlighteds();
    } else {
      const parentFullName = parentNameParts.join("/");
      this.setHighlighteds(parentFullName, this.storages);
    }

    this.currentStorage = storage.parent;
  }

  clearHighlighteds() {
    const clear = (nodes: StorageNode[]) => {
      nodes.forEach(n => {
        n.isHighlighted = false;
        if (n.children && n.children.length) {
          clear(n.children);
        }
      });
    };

    clear(this.storages);
  }

  setHighlighteds(_fullName: string, _nodes: StorageNode[]) {
    this.clearHighlighteds();

    const setHighlighted = (fullName: string, nodes: StorageNode[]) => {
      const parts = fullName.split("/").filter(n => n != "");
      const name = parts[0];

      const targetNode = nodes.find(t => t.name == name);
      if (!targetNode) {
        return;
      }

      targetNode.isHighlighted = true;

      if (parts.length > 1) {
        setHighlighted(parts.slice(1, parts.length).join("/"), targetNode.children);
      } else {
        this.currentStorage = targetNode;
      }
    };
    setHighlighted(_fullName, _nodes);
  }

  getFilter(name: string) {
    return {name: {$regex: `^${name}/$|^${name}\/[^\/]+\/?$`}};
  }

  buildFilterByFullName(fullName: string) {
    const parts = fullName.split("/").filter(n => n != "");

    const filters = [];

    let endIndex = 1;
    while (true) {
      const name = parts.slice(0, endIndex).join("/");
      const filter = this.getFilter(name);
      filters.push(filter);
      endIndex++;
      if (endIndex > parts.length) {
        break;
      }
    }

    return {$or: filters};
  }

  onColumnClicked(storage: StorageNode) {
    this.onStorageHighlighted(storage.parent);
  }

  objectIdToDate(objectId) {
    return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
  }

  addRootDir() {
    return this.storage
      .getAll({name: {$regex: listDirectoriesRegex}})
      .toPromise()
      .then(objects => {
        const existingNames = objects.map(o => o.name);
        return this.openAddDirDialog("root_directory", existingNames, name => {
          this.rootDirService
            .add(`${name}/`)
            .toPromise()
            .then(() => this.router.navigate(["storage", name]));
        });
      });
  }

  openAddDirDialog(
    type: "root_directory" | "sub_directory",
    existingNames: string[],
    afterClosed: (name) => void
  ) {
    const dialogRef = this.dialog.open(AddDirectoryDialog, {
      width: "500px",
      data: {
        existingNames,
        type
      }
    });

    dialogRef.afterClosed().subscribe(name => {
      if (!name) {
        return;
      }
      afterClosed(name);
    });
  }

  addSubDir(storage: StorageNode) {
    const target = storage.isDirectory ? storage : storage.parent;

    const existingNames = target.children.map(storage => storage.name);

    this.openAddDirDialog("sub_directory", existingNames, name => {
      const prefix = getFullName(target);
      return this.addDirectory(prefix ? `${prefix}/${name}/` : `${name}/`);
    });
  }

  enableSelectMode() {
    this.currentStorage = this.currentStorage.isDirectory
      ? this.currentStorage
      : this.currentStorage.parent;
    this.selectionActive = true;
    this.selectedStorageIds = [];
  }

  disableSelectMode() {
    this.selectionActive = false;
    this.selectedStorageIds = [];
  }

  onSelect(storage: StorageNode) {
    const updateSelecteds = (selecteds: string[], storage: StorageNode, action: "push" | "pop") => {
      const isExist = selecteds.includes(storage._id);

      if (action == "push" && !isExist) {
        selecteds.push(storage._id);
      } else if (action == "pop" && isExist) {
        selecteds.splice(selecteds.indexOf(storage._id), 1);
      }

      if (storage.children) {
        storage.children.forEach(c => updateSelecteds(selecteds, c, action));
      }
    };

    const action = this.selectedStorageIds.indexOf(storage._id) != -1 ? "pop" : "push";
    updateSelecteds(this.selectedStorageIds, storage, action);
  }

  onRenameClicked(storage: StorageNode, element) {
    this.renamingStorage = storage;
    setTimeout(() => element.focus(), 0);
  }

  onRenameCancelled() {
    this.renamingStorage = undefined;
  }

  updateStorageName(name: string) {
    if (!this.renamingStorage) {
      return;
    }

    console.log("UPDATING..");
    this.refresh.next();
  }
}
