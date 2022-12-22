import {BreakpointObserver, Breakpoints, BreakpointState} from "@angular/cdk/layout";
import {HttpEventType} from "@angular/common/http";
import {Component, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {ActivatedRoute, Router} from "@angular/router";
import {AddFolderDialogComponent} from "@spica-client/storage/components/add-folder-dialog/add-folder-dialog.component";
import {listDirectoriesRegex} from "@spica-client/storage/helpers";
import {BehaviorSubject, Subject, combineLatest, Subscription, of} from "rxjs";
import {filter, map, switchMap, tap} from "rxjs/operators";
import {ImageEditorComponent} from "../../components/image-editor/image-editor.component";
import {StorageDialogOverviewDialog} from "../../components/storage-dialog-overview/storage-dialog-overview";
import {Storage, StorageNode} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";

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
  selectableStorageIds = [];

  selectionActive = false;

  currentStorage: StorageNode;

  root: string;

  filter$ = new Subject<object>();

  constructor(
    private storage: StorageService,
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
          this.setHighlighteds(this.getFullName(this.currentStorage), this.storages);
        }),
        tap(() => this.loading$.next(false))
      )
      .subscribe();

    const routeSubs = this.route.params
      .pipe(
        tap(params => {
          if (!params.name) {
            this.root = undefined;
            this.addDirectory();
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

    return this.getFullName(target);
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
      const parentFullName = this.getFullName(node.parent);
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

  findNodeById(_id: string) {
    let targetNode;

    const find = (node: StorageNode) => {
      if (node._id == _id) {
        targetNode = node;
        return;
      }

      if (node.children) {
        node.children.forEach(n => find(n));
      }
    };

    this.storages.forEach(s => find(s));

    return targetNode;
  }

  // getIdsWillBeDeleted(id: string) {
  //   let idsPromise: Promise<string[]> = of([id]).toPromise();
  //   const node = this.findNodeById(id);

  //   if (node.isDirectory) {
  //     const fullName = this.getFullName(node);
  //     idsPromise = this.storage
  //       .getAll({name: {$regex: `^${fullName}`}})
  //       .toPromise()
  //       .then(objects => objects.map(o => o._id));
  //   }

  //   return idsPromise;
  // }

  delete(id: string) {
    return this.storage
      .delete(id)
      .toPromise()
      .then(() => {
        this.currentStorage = this.currentStorage.parent;
        this.refresh.next();
      });
  }

  listObjectsUnderIds(ids: string[]) {
    const storages = [];
    const promises = ids.map(id => {
      const node = this.findNodeById(id);
      const fullName = this.getFullName(node);

      let regex = `^${fullName}`;
      if (node.isDirectory) {
        regex += "/";
      }

      const filter = {name: {$regex: regex}};
      return this.storage
        .getAll(filter)
        .toPromise()
        .then(r => storages.push(...r));
    });

    return Promise.all(promises).then(() => storages);
  }

  deleteMany(ids: string[]) {
    return this.listObjectsUnderIds(ids)
      .then(objects => Promise.all(objects.map(o => this.storage.delete(o._id).toPromise())))
      .then(() => this.refresh.next());
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

  saveFolder(name: string) {
    const folder = new File([], name);
    return this.storage
      .insertMany([folder] as any)
      .toPromise()
      .then(() => this.refresh.next());
  }

  mapNodesToObjects(nodes: StorageNode[]) {
    nodes.forEach(node => {
      node.name = this.getFullName(node);
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
        newObj.isDirectory = this.isDirectory(obj);
        mapPath(newObj, currentNode.children, currentNode, depth);
      } else {
        currentNode.content = obj.content;
        currentNode.url = obj.url;
        currentNode._id = obj._id;
        currentNode.isDirectory = this.isDirectory(obj);
      }
    };

    for (let object of objects) {
      mapPath(object, result, undefined, 1);
    }

    return result;
  }

  onStorageHighlighted(storage: StorageNode) {
    this.currentStorage = storage;

    const fullName = this.getFullName(storage);

    if (!storage.isDirectory) {
      return this.setHighlighteds(fullName, this.storages);
    }

    const filter = this.buildFilterByFullName(fullName);
    this.filter$.next(filter);
  }

  onDetailsClosed(storage: StorageNode) {
    const fullName = this.getFullName(storage);

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

  isDirectory(storage: StorageNode | Storage) {
    return storage.content.size == 0 && storage.content.type == "";
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

  getFullName(storage: StorageNode, suffix?: string) {
    const newName = suffix ? `${storage.name}/${suffix}` : storage.name;
    if (storage.parent) {
      return this.getFullName(storage.parent, newName);
    } else {
      return newName;
    }
  }

  onColumnClicked(storage: StorageNode) {
    this.onStorageHighlighted(storage.parent);
  }

  objectIdToDate(objectId) {
    return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
  }

  addDirectory() {
    return this.storage
      .getAll({name: {$regex: listDirectoriesRegex}})
      .toPromise()
      .then(objects => {
        const existingNames = objects.map(o => o.name);
        return this.openAddFolderDialog("directory", existingNames, name => {
          this.saveFolder(`${name}/`).then(() => this.router.navigate(["storage", name]));
        });
      });
  }

  openAddFolderDialog(
    type: "folder" | "directory",
    existingNames: string[],
    afterClosed: (name) => void
  ) {
    const dialogRef = this.dialog.open(AddFolderDialogComponent, {
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

  addFolder(storage: StorageNode) {
    const target = storage.isDirectory ? storage : storage.parent;

    const existingNames = target.children.map(storage => storage.name);

    this.openAddFolderDialog("folder", existingNames, name => {
      const prefix = this.getFullName(target);
      return this.saveFolder(prefix ? `${prefix}/${name}/` : `${name}/`);
    });
  }

  enableSelectMode() {
    this.currentStorage = this.currentStorage.isDirectory
      ? this.currentStorage
      : this.currentStorage.parent;
    this.selectionActive = true;
    // const target = this.currentStorage.isDirectory
    //   ? this.currentStorage.children
    //   : this.currentStorage.parent.children;
    // this.selectableStorageIds = target.map(c => c._id);
    this.selectedStorageIds = [];
  }

  disableSelectMode() {
    this.selectionActive = false;
    // this.selectableStorageIds = [];
    this.selectedStorageIds = [];
  }

  onSelect(storage: StorageNode) {
    // if (this.selectableStorageIds.indexOf(storage._id) == -1) {
    //   return;
    // }

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
}
