import {CdkDrag, CdkDragDrop, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
import {BreakpointObserver, Breakpoints, BreakpointState} from "@angular/cdk/layout";
import {HttpEventType} from "@angular/common/http";
import {Component, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {ActivatedRoute, Router} from "@angular/router";
import {PassportService} from "@spica-client/passport";
import {AddDirectoryDialog} from "@spica-client/storage/components/add-directory-dialog/add-directory-dialog.component";
import {
  Filters,
  findNodeByName,
  getCanDropChecks,
  getFullName,
  mapNodesToObjects,
  mapObjectsToNodes
} from "@spica-client/storage/helpers";
import {RootDirService} from "@spica-client/storage/services/root.dir.service";
import {BehaviorSubject, Subject, combineLatest, Subscription} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
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

  selectedStorageNames = [];
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

  updateNodes(nodes: StorageNode[]) {
    if (this.root == "") {
      const rootParent = {
        name: this.root,
        children: nodes,
        isDirectory: true,
        isHighlighted: true,
        parent: undefined
      };
      nodes.forEach(n => (n.parent = rootParent));
      nodes = [rootParent];
    }
    this.nodes = nodes;

    if (!this.currentNode) {
      this.currentNode = this.nodes[0];
    }

    const newCurrentNode = findNodeByName(getFullName(this.currentNode), this.nodes);

    if (!newCurrentNode) {
      return;
    }

    this.currentNode = newCurrentNode;
    this.setHighlighteds(this.currentNode);
  }

  ngOnInit(): void {
    const storagesSubs = combineLatest([this.refresh, this.filter$])
      .pipe(
        tap(() => this.loading$.next(true)),
        switchMap(([_, filter]) => this.storageService.getAll({filter, sort: this.sorter})),
        tap(storages => {
          const newNodes = mapObjectsToNodes(storages);
          this.updateNodes(newNodes);
        }),
        tap(() => this.loading$.next(false))
      )
      .subscribe();

    const routeSubs = this.route.params.subscribe(({name}) => {
      this.root = name || "";

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
    return this.rootDirService.delete(this.root).then(() => {
      this.rootDirService
        .findAll()
        .toPromise()
        .then(r => {
          if (!r || !r.length) {
            return this.router.navigate(["storages"]);
          }

          const target = r[0].name.replace("/", "");
          return this.router.navigate(["storage", target]);
        });
    });
  }

  async deleteMany(names: string[]) {
    const findShallowestDeletedStorage = (node: StorageNode, _names: string[]) => {
      const hasSelectedParent = node.parent && _names.includes(getFullName(node.parent));
      return hasSelectedParent ? findShallowestDeletedStorage(node.parent, _names) : node;
    };

    const idsWillBeDeleted = new Set<string>();

    const idsPromises = [];

    for (const name of names) {
      const node = findNodeByName(name, this.nodes);
      const shallowestDeletedNode = findShallowestDeletedStorage(node, names);
      if (shallowestDeletedNode.isDirectory) {
        const fullName = getFullName(shallowestDeletedNode);
        idsPromises.push(
          this.storageService
            .listSubResources(fullName, true)
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

    this.setHighlighteds(node);
  }

  onDetailsClosed(node: StorageNode) {
    this.currentNode = node.parent;
    this.setHighlighteds(node);
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

  setHighlighteds(node: StorageNode) {
    this.clearHighlighteds();

    const setHighlighted = _node => {
      _node.isHighlighted = true;
      if (_node.parent) {
        setHighlighted(_node.parent);
      }
    };

    setHighlighted(node);
  }

  buildFilterForDir(fullName: string) {
    if (!fullName) {
      return null;
    }

    return Filters.ListAllChildren(fullName, true);
  }

  onColumnClicked(nodes: StorageNode[]) {
    if (nodes.length) {
      this.onNodeHighlighted(nodes[0].parent);
    }
  }

  objectIdToDate(objectId) {
    return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
  }

  addRootDir() {
    return this.rootDirService
      .findAll()
      .toPromise()
      .then(objects => {
        const existingNames = objects.map(o => {
          return o.name.replace("/", "");
        });
        return this.openAddDirDialog("directory", existingNames, name => {
          this.rootDirService
            .add(`${name}/`)
            .toPromise()
            .then(() => this.router.navigate(["storage", name]));
        });
      });
  }

  openAddDirDialog(
    type: "directory" | "folder",
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

  addSubDir() {
    const target = this.currentNode.isDirectory ? this.currentNode : this.currentNode.parent;

    const existingNames = target.children.map(c => c.name);

    this.openAddDirDialog("folder", existingNames, name => {
      const prefix = getFullName(target);
      return this.addDirectory(prefix ? `${prefix}${name}/` : `${name}/`);
    });
  }

  enableSelectMode() {
    this.currentNode = this.currentNode.isDirectory ? this.currentNode : this.currentNode.parent;
    this.selectionActive = true;
    this.selectedStorageNames = [];
  }

  disableSelectMode() {
    this.selectionActive = false;
    this.selectedStorageNames = [];
  }

  onSelect(node: StorageNode) {
    const updateSelecteds = (selecteds: string[], _node: StorageNode, action: "push" | "pop") => {
      const _fullName = getFullName(_node);
      const isExist = selecteds.includes(_fullName);

      if (action == "push" && !isExist) {
        selecteds.push(_fullName);
      } else if (action == "pop" && isExist) {
        selecteds.splice(selecteds.indexOf(_fullName), 1);
      }

      if (_node.children) {
        _node.children.forEach(c => updateSelecteds(selecteds, c, action));
      }
    };

    const action = this.selectedStorageNames.indexOf(getFullName(node)) != -1 ? "pop" : "push";
    updateSelecteds(this.selectedStorageNames, node, action);
  }

  // to make html use it;
  getFullName = getFullName;

  onRenameClicked(node: StorageNode, element) {
    this.renamingNode = node;
    setTimeout(() => element.focus(), 0);
  }

  onRenameCancelled() {
    this.renamingNode = undefined;
  }

  async updateStorageName(node: StorageNode, oldFullName: string, newFullName: string) {
    let subStorages: Storage[] = [];
    if (!node.isDirectory) {
      subStorages = [{_id: node._id, name: oldFullName}];
    } else {
      subStorages = await this.storageService.listSubResources(oldFullName, true);
    }

    const updates = subStorages
      .map(s => {
        s.name = s.name.replace(oldFullName, newFullName);
        return s;
      })
      .map(s => this.storageService.updateName(s._id, s.name).toPromise());

    return Promise.all(updates);
  }

  onRenameCompleted(newName: string, node: StorageNode) {
    if (!this.renamingNode || node.parent.children.some(c => c.name == newName)) {
      this.onRenameCancelled();
      return;
    }

    const oldFullName = getFullName(node);

    node.name = newName;
    const newFullName = getFullName(node);

    return this.updateStorageName(node, oldFullName, newFullName).then(() => {
      this.onRenameCancelled();
      this.refresh.next();
    });
  }

  onDropped(event: CdkDragDrop<StorageNode[]>) {
    const oldParent = event.previousContainer.data[0].parent;
    const newParent = event.container.data.length
      ? event.container.data[0].parent
      : this.currentNode;

    const node = event.previousContainer.data[event.previousIndex];

    const canDrop = getCanDropChecks().every(check => check(oldParent, newParent, node));

    if (!canDrop) {
      return;
    }

    const oldPrefix = getFullName(oldParent);
    const newPrefix = getFullName(newParent);

    const oldFullName = getFullName(node);
    const newFullName = oldFullName.replace(oldPrefix, newPrefix);

    this.updateDDLists(event);

    return this.updateStorageName(node, oldFullName, newFullName).then(() => this.refresh.next());
  }

  updateDDLists(event: CdkDragDrop<StorageNode[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
  }
}
