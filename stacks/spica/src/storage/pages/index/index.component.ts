import {BreakpointObserver, Breakpoints, BreakpointState} from "@angular/cdk/layout";
import {HttpEventType} from "@angular/common/http";
import {Component, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {ActivatedRoute} from "@angular/router";
import {AddFolderDialogComponent} from "@spica-client/storage/components/add-folder-dialog/add-folder-dialog.component";
import {BehaviorSubject, Subject, combineLatest, Subscription} from "rxjs";
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

  selectionActive = false;

  selectedStorage: StorageNode;

  root: string;

  //prettier-ignore
  // baseFilter:any = {name:{$regex:'/^\/[^\/]+\/$|^[^\/]+\/$|^[^\/]+$'}}
  filter$ = new Subject<any>();

  constructor(
    private storage: StorageService,
    public breakpointObserver: BreakpointObserver,
    public dialog: MatDialog,
    private route: ActivatedRoute
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
    const storagesSubs = combineLatest([this.refresh, this.filter$])
      .pipe(
        tap(() => this.loading$.next(true)),
        switchMap(([_, filter]) => this.storage.getAll(filter, undefined, undefined, this.sorter)),
        map(storages => (this.storages = this.mapObjectsToNodes(storages))),
        tap(() => {
          this.selectedStorage = this.selectedStorage || this.storages[0];
          this.setSelecteds(this.getFullName(this.selectedStorage), this.storages);
        }),
        tap(() => this.loading$.next(false))
      )
      .subscribe();

    const routeSubs = this.route.params
      .pipe(
        filter(params => params.name),
        map(params => params.name)
      )
      .subscribe(name => {
        this.selectedStorage = undefined;

        this.root = name;

        const filter = this.buildFilterByFullName(this.root);
        this.filter$.next(filter);
      });

    this.subscriptions.push(storagesSubs, routeSubs);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  getCurrentDir() {
    const parent = this.selectedStorage.isDirectory
      ? this.selectedStorage
      : this.selectedStorage.parent;

    return this.getFullName(parent);
  }

  uploadStorageMany(file: FileList): void {
    if (file.length) {
      const prefix = this.getCurrentDir();
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

  delete(id: string): void {
    this.storage
      .delete(id)
      .toPromise()
      .catch()
      .then(() => {
        this.selectedStorage = undefined;
        this.refresh.next();
      });
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

  saveFolder(name: string) {
    const folder = new File([], name);
    this.storage
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
      delete node.isSelected;
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
          isSelected: false
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

  onStorageSelect(storage: StorageNode) {
    this.selectedStorage = storage;

    const fullName = this.getFullName(storage);

    if (!storage.isDirectory) {
      return this.setSelecteds(fullName, this.storages);
    }

    const filter = this.buildFilterByFullName(fullName);
    this.filter$.next(filter);
  }

  onDetailsClosed(storage: StorageNode) {
    const fullName = this.getFullName(storage);

    const parentNameParts = fullName.split("/").filter(n => n != "");
    parentNameParts.pop();

    if (!parentNameParts.length) {
      this.clearSelecteds();
    } else {
      const parentFullName = parentNameParts.join("/");
      this.setSelecteds(parentFullName, this.storages);
    }

    this.selectedStorage = undefined;
  }

  clearSelecteds() {
    const clear = (nodes: StorageNode[]) => {
      nodes.forEach(n => {
        n.isSelected = false;
        if (n.children && n.children.length) {
          clear(n.children);
        }
      });
    };

    clear(this.storages);
  }

  setSelecteds(_fullName: string, _nodes: StorageNode[]) {
    this.clearSelecteds();

    const setSelected = (fullName: string, nodes: StorageNode[]) => {
      const parts = fullName.split("/").filter(n => n != "");
      const name = parts[0];

      const targetNode = nodes.find(t => t.name == name);
      if (!targetNode) {
        return;
      }

      targetNode.isSelected = true;

      if (parts.length > 1) {
        setSelected(parts.slice(1, parts.length).join("/"), targetNode.children);
      } else {
        this.selectedStorage = targetNode;
      }
    };
    setSelected(_fullName, _nodes);
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
    this.onStorageSelect(storage.parent);
  }

  // getRootStorages() {
  //   return {
  //     name: this.root,
  //     parent: undefined,
  //     children: this.storages,
  //     depth: 0,
  //     isDirectory: true,
  //     isSelected: true,
  //     content: {
  //       type: "",
  //       size: 0
  //     }
  //   } as StorageTree;
  // }

  objectIdToDate(objectId) {
    return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
  }

  addFolder(storage: StorageNode) {
    const target = storage.isDirectory ? storage : storage.parent;

    const existingNames = target.children.reduce((existings, storage) => {
      existings.push(storage.name);
      return existings;
    }, []);

    const dialogRef = this.dialog.open(AddFolderDialogComponent, {
      width: "500px",
      maxHeight: "90vh",
      data: {
        existingNames
      }
    });

    return dialogRef.afterClosed().subscribe(name => {
      if (!name) {
        return;
      }

      const fullName = this.getFullName(target);

      return this.saveFolder(fullName ? `${fullName}/${name}/` : `${name}/`);
    });
  }
}
