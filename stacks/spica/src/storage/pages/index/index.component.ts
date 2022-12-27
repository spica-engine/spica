import {BreakpointObserver, Breakpoints, BreakpointState} from "@angular/cdk/layout";
import {HttpEventType} from "@angular/common/http";
import {Component, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {ActivatedRoute, Router} from "@angular/router";
import {AddDirectoryDialog} from "@spica-client/storage/components/add-directory-dialog/add-directory-dialog.component";
import {
  Filters,
  findNodeById,
  getFullName,
  mapNodesToObjects,
  mapObjectsToNodes
} from "@spica-client/storage/helpers";
import {RootDirService} from "@spica-client/storage/services/root.dir.service";
import {BehaviorSubject, Subject, combineLatest, Subscription} from "rxjs";
import {filter, map, switchMap, tap} from "rxjs/operators";
import {ImageEditorComponent} from "../../components/image-editor/image-editor.component";
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

  nodes: StorageNode[] = [];
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

  currentNode: StorageNode;

  root: string;

  filter$ = new Subject<object>();

  renamingNode: StorageNode;

  constructor(
    private storageService: StorageService,
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

  ngOnInit(): void {
    const storagesSubs = combineLatest([this.refresh, this.filter$])
      .pipe(
        tap(() => this.loading$.next(true)),
        switchMap(([_, filter]) => this.storageService.getAll({filter, sort: this.sorter})),
        map(storages => (this.nodes = mapObjectsToNodes(storages))),
        tap(() => {
          this.currentNode = this.currentNode || this.nodes[0];
          this.setHighlighteds(getFullName(this.currentNode), this.nodes);
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
        this.currentNode = undefined;

        this.root = name;

        const filter = this.buildFilterForDir(this.root);
        this.filter$.next(filter);
      });

    this.subscriptions.push(storagesSubs, routeSubs);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  getCurrentDirName() {
    const target = this.currentNode.isDirectory ? this.currentNode : this.currentNode.parent;

    return getFullName(target);
  }

  uploadStorageMany(file: FileList): void {
    if (file.length) {
      const prefix = this.getCurrentDirName();
      this.storageService.insertMany(file, prefix).subscribe(
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
      const prefix = this.getCurrentDirName();
      const storage = mapNodesToObjects([node])[0];
      storage.name = `${prefix}${file.name}`;

      this.updates.set(storage._id, 0);

      this.storageService.updateOne(storage, file).subscribe(
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
    return this.storageService
      .delete(id)
      .toPromise()
      .then(() => {
        this.currentNode = this.currentNode.parent;
        this.refresh.next();
      });
  }

  deleteRootDir() {
    return this.rootDirService.delete(this.root).then(() => this.refresh.next());
  }

  async deleteMany(ids: string[]) {
    const findShallowestDeletedStorage = (node: StorageNode, _ids: string[]) => {
      const hasSelectedParent = node.parent && _ids.includes(node.parent._id);
      return hasSelectedParent ? findShallowestDeletedStorage(node.parent, _ids) : node;
    };

    const idsWillBeDeleted = new Set<string>();

    const idsPromises = [];

    for (const id of ids) {
      const node = findNodeById(id, this.nodes);
      const shallowestDeletedNode = findShallowestDeletedStorage(node, ids);
      if (shallowestDeletedNode.isDirectory) {
        const fullName = getFullName(shallowestDeletedNode);
        idsPromises.push(
          this.storageService
            .listSubResources(fullName,true)
            .then(storages => storages.forEach(s => idsWillBeDeleted.add(s._id)))
        );
      } else {
        idsWillBeDeleted.add(node._id);
      }
    }

    await Promise.all(idsPromises);
    await Promise.all(
      Array.from(idsWillBeDeleted).map(id => this.storageService.delete(id).toPromise())
    );
    this.refresh.next();
  }

  sortStorage(value) {
    value.direction = value.direction === "asc" ? 1 : -1;
    this.sorter = {[value.name]: value.direction};
    this.refresh.next();
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
    return this.storageService
      .insertMany([dir] as any)
      .toPromise()
      .then(() => this.refresh.next());
  }

  onNodeHighlighted(node: StorageNode) {
    this.currentNode = node;

    const fullName = getFullName(node);

    if (!node.isDirectory) {
      return this.setHighlighteds(fullName, this.nodes);
    }

    const filter = this.buildFilterForDir(fullName);
    this.filter$.next(filter);
  }

  onDetailsClosed(node: StorageNode) {
    const fullName = getFullName(node);

    const parentNameParts = fullName.split("/").filter(n => n != "");
    parentNameParts.pop();

    if (!parentNameParts.length) {
      this.clearHighlighteds();
    } else {
      const parentFullName = parentNameParts.join("/");
      this.setHighlighteds(parentFullName, this.nodes);
    }

    this.currentNode = node.parent;
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

    clear(this.nodes);
  }

  setHighlighteds(fullName: string, nodes: StorageNode[]) {
    this.clearHighlighteds();

    const setHighlighted = (_fullName: string, _nodes: StorageNode[]) => {
      const parts = _fullName.split("/").filter(n => n != "");
      const name = parts[0];

      const targetNode = _nodes.find(t => t.name == name);
      if (!targetNode) {
        return;
      }

      targetNode.isHighlighted = true;

      if (parts.length > 1) {
        setHighlighted(parts.slice(1, parts.length).join("/"), targetNode.children);
      } else {
        this.currentNode = targetNode;
      }
    };
    setHighlighted(fullName, nodes);
  }

  buildFilterForDir(fullName: string) {
    const parts = fullName.split("/").filter(n => n != "");

    const filters = [];

    let endIndex = 1;
    while (true) {
      let name = parts.slice(0, endIndex).join("/");
      name += "/";

      // root directory should return itself to keep consistency but sub directories don't have to
      const filter = Filters.ListFirstSubs(name, endIndex == 1);

      filters.push(filter);

      endIndex++;
      if (endIndex > parts.length) {
        break;
      }
    }

    return {$or: filters};
  }

  onColumnClicked(node: StorageNode) {
    this.onNodeHighlighted(node.parent);
  }

  objectIdToDate(objectId) {
    return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
  }

  addRootDir() {
    return this.rootDirService.findAll().then(objects => {
      const existingNames = objects.map(o => {
        return o.name.replace("/", "");
      });
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

  addSubDir(node: StorageNode) {
    const target = node.isDirectory ? node : node.parent;

    const existingNames = target.children.map(c => c.name);

    this.openAddDirDialog("sub_directory", existingNames, name => {
      const prefix = getFullName(target);
      return this.addDirectory(prefix ? `${prefix}${name}/` : `${name}/`);
    });
  }

  enableSelectMode() {
    this.currentNode = this.currentNode.isDirectory ? this.currentNode : this.currentNode.parent;
    this.selectionActive = true;
    this.selectedStorageIds = [];
  }

  disableSelectMode() {
    this.selectionActive = false;
    this.selectedStorageIds = [];
  }

  onSelect(node: StorageNode) {
    const updateSelecteds = (selecteds: string[], _node: StorageNode, action: "push" | "pop") => {
      const isExist = selecteds.includes(_node._id);

      if (action == "push" && !isExist) {
        selecteds.push(_node._id);
      } else if (action == "pop" && isExist) {
        selecteds.splice(selecteds.indexOf(_node._id), 1);
      }

      if (_node.children) {
        _node.children.forEach(c => updateSelecteds(selecteds, c, action));
      }
    };

    const action = this.selectedStorageIds.indexOf(node._id) != -1 ? "pop" : "push";
    updateSelecteds(this.selectedStorageIds, node, action);
  }

  onRenameClicked(node: StorageNode, element) {
    this.renamingNode = node;
    setTimeout(() => element.focus(), 0);
  }

  onRenameCancelled() {
    this.renamingNode = undefined;
  }

  async updateStorageName(newName: string, node: StorageNode) {
    if (!this.renamingNode) {
      return;
    }

    const oldFullName = getFullName(node);
    node.name = newName;
    const newFullName = getFullName(node);

    let subStorages: Storage[] = [];
    if (!node.isDirectory) {
      subStorages = [{_id: node._id, name: oldFullName}];
    } else {
      subStorages = await this.storageService.listSubResources(oldFullName,true);
    }
    const updates = subStorages
      .map(s => {
        s.name = s.name.replace(oldFullName, newFullName);
        return s;
      })
      .map(s => this.storageService.updateName(s._id, s.name).toPromise());

    return Promise.all(updates).then(() => {
      this.onRenameCancelled();
      this.refresh.next();
    });
  }
}
