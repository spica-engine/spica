import {Component, NgZone, OnDestroy, OnInit} from "@angular/core";
import {NgModel} from "@angular/forms";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {DomSanitizer} from "@angular/platform-browser";
import {Observable, of} from "rxjs";
import {flatMap, switchMap, tap} from "rxjs/operators";
import {BuildProgressComponent} from "../components/build-progress/build-progress.component";
import {BuilderComponent} from "../components/builder/builder.component";
import {ViewportTarget} from "../components/viewport/viewport.component";
import {ComposerClient} from "../composer.client";
import {Collection, ElementSchema, Page, Palette} from "../interface";
import {CreatorComponent} from "./../components/creator/creator.component";
import {PageDeleteDialogComponent} from "./../components/page-delete-dialog/page-delete-dialog.component";

@Component({
  selector: "composer-compose",
  templateUrl: "./compose.component.html",
  styleUrls: ["./compose.component.scss"]
})
export class ComposeComponent implements OnInit, OnDestroy {
  public ComposerState = ComposerState;
  public progress = 0;
  public state: ComposerState = ComposerState.Disconnected;
  public error: Error | string;

  public font: any;
  readonly alphabet: string = "abcdefghijklmnopqrstuvwxyz";
  fonts = [
    {
      name: "Montserrat",
      src: "https://fonts.googleapis.com/css?family=Montserrat",
      family: "Montserrat"
    },
    {
      name: "Modern Antiqua",
      src: "https://fonts.googleapis.com/css?family=Modern+Antiqua",
      family: "Modern Antiqua"
    },
    {name: "Karla", src: "https://fonts.googleapis.com/css?family=Karla", family: "Karla"}
  ];

  route: string;
  base: string;
  source: string;

  $collections: Observable<Array<Collection>>;
  $elements: Observable<Array<ElementSchema>>;
  $pages: Observable<Array<Page>>;
  $palettes: Array<Palette>;
  $customCode: Observable<string>;

  private pages: Array<Page>;
  private builderRef: MatDialogRef<BuilderComponent>;

  public childTarget: ViewportTarget;

  public isCollectionInstallPending: boolean;
  public menuVisibility: boolean = false;

  constructor(
    public sanitizer: DomSanitizer,
    private composer: ComposerClient,
    private dialog: MatDialog,
    private zone: NgZone
  ) {
    this.$pages = composer.pages.pipe(
      tap(pages => {
        const [page] = pages;
        if (!page) {
          return;
        }
        this.pages = pages;
        this.route = page.path;
        this.source = page.source;
      })
    );
    this.$elements = composer.fromEvent("elements");
    this.$collections = composer.fromEvent("collections");
    this.$customCode = composer.fromEvent("custom code");

    composer
      .fromEvent<Array<Palette>>("palettes")
      .subscribe(palettes => (this.$palettes = palettes));
  }

  routeChange(route: string) {
    this.source = this.pages.find(p => p.path == route).source;
  }

  addCollection(model: NgModel) {
    if (this.isCollectionInstallPending) {
      return;
    }
    this.isCollectionInstallPending = true;
    this.composer.emit("add collection", model.value, val => {
      if (typeof val == "string") {
        model.control.setErrors({error: val});
        model.control.markAsTouched();
        model.control.markAsDirty();
      } else {
        this.composer.emit("elements");
        model.reset();
      }
      this.isCollectionInstallPending = false;
    });
  }

  editElement(target: ViewportTarget) {
    this.builderRef = this.zone.run(() =>
      this.dialog.open(BuilderComponent, {
        width: "100%",
        height: "100%",
        maxWidth: "unset",
        data: {index: target.index, ancestors: target.ancestors, path: this.source},
        hasBackdrop: false,
        autoFocus: true,
        panelClass: "builder"
      })
    );
  }

  moveElement(target: ViewportTarget, to: "up" | "down") {
    this.composer.emit(
      "move element",
      {ancestors: target.ancestors, index: target.index, path: this.source},
      to
    );
  }

  removeElement(target: ViewportTarget) {
    this.composer.emit("remove element", {
      ancestors: target.ancestors,
      index: target.index,
      path: this.source
    });
  }

  applyPalette(palette: Palette, target?: ViewportTarget) {
    this.composer.emit(
      "update palette",
      target && {index: target.index, ancestors: target.ancestors, path: this.source},
      palette
    );
  }

  updateStyles(target: ViewportTarget, style: "boxed" | "full") {
    this.composer.emit(
      "update container styles",
      {ancestors: target.ancestors, index: target.index, path: this.source},
      style
    );
  }

  updateCustomCode(code: string) {
    return this.composer.emit("update custom code", code);
  }

  addPage(name: string, route: string) {
    this.composer.addPage({name, route});
  }

  addElement(name: string) {
    if (this.childTarget) {
      this.composer.emit(
        "add element",
        {path: this.source, ancestors: this.childTarget.ancestors, index: this.childTarget.index},
        name
      );
      this.childEnd();
    } else {
      this.composer.emit("add element", {path: this.source, ancestors: []}, name);
    }
  }

  childStart(target: ViewportTarget) {
    this.childTarget = target;
    this.composer.emit("elements", {
      path: this.source,
      ancestors: this.childTarget.ancestors,
      index: this.childTarget.index
    });
  }

  childEnd() {
    this.childTarget = undefined;
    this.composer.emit("elements");
  }

  reset() {
    this.progress = 0;
    this.route = undefined;
    this.base = undefined;
    this.error = undefined;
    this.isCollectionInstallPending = undefined;
    if (this.builderRef) {
      this.builderRef.close();
    }
    console.clear();
  }

  deleteOpenDialog() {
    this.dialog.open(PageDeleteDialogComponent, {panelClass: "page-delete-dialog"});
  }
  openBuildDialog() {
    this.dialog.open(BuildProgressComponent, {panelClass: "build-progress"});
  }

  openCreatorDialog(options: any) {
    return this.dialog
      .open(CreatorComponent, {panelClass: "creator-dialog", data: options})
      .afterClosed()
      .pipe(switchMap(options => this.composer.emitAck("initialize", options)));
  }

  ngOnInit(): void {
    this.composer.connect
      .pipe(
        tap(() => this.reset()),
        tap(() => (this.state = ComposerState.Connected)),
        switchMap(() => this.composer.emitAck<string>("ready")), // Check if initialized
        switchMap(state => (state != "ready" ? this.openCreatorDialog(state) : of(null))),
        tap(() => (this.state = ComposerState.Ready)),
        tap(() => {
          this.composer.emit("collections");
          this.composer.emit("elements");
          this.composer.emit("palettes");
          this.composer.emit("custom code");
        }),
        flatMap(() => this.composer.serve()) // Serve content
      )
      .subscribe({
        next: event => {
          this.progress = event.progress;
          if (event.state == "stopped") {
            this.base = event.url;
            this.state = ComposerState.Started;
          }
        },
        complete: () => {
          this.state = ComposerState.Disconnected;
        }
      });
  }

  ngOnDestroy(): void {
    this.composer.close();
  }
}

enum ComposerState {
  Disconnected = 0,
  Error = 1,
  Connected = 2,
  Ready = 3,
  Started = 4
}
