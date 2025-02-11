import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Injector,
  Input,
  NgModuleRef,
  NgProbeToken,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  Testability,
  ViewChild
} from "@angular/core";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {Router} from "@angular/router";
import {fromEvent, merge, of} from "rxjs";
import {filter, flatMap, map, switchMap, takeUntil} from "rxjs/operators";
import SockJS from "sockjs-client";

import {forEachAncestor} from "../../utils";

import {HEADER_OFFSET, HOST, PARENT, T_HOST, TVIEW, TYPE, VIEWS} from "./view";

@Component({
  selector: "composer-viewport",
  template: `
    <iframe #iframe (load)="_load()" [src]="_url" [attr.height.px]="height" scrolling="no"></iframe>
  `,
  styleUrls: ["./viewport.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: "composerViewport"
})
export class ViewportComponent implements OnChanges, OnDestroy {
  @ViewChild("iframe", {static: true}) private iframe: ElementRef<HTMLIFrameElement>;
  // Do not change it directly use Viewport.base | Viewport.route instead
  // @internal
  public _url: SafeResourceUrl;

  public get height() {
    const document = this.getDocument();
    if (document) {
      return document.defaultView.getComputedStyle(document.body).getPropertyValue("height");
    }
    return 0;
  }

  @Input() public font: Font;

  @Input() public route: string;
  @Output() readonly routeChange = new EventEmitter();
  @Input() public base: string;

  public target: ViewportTarget;
  @Output() event = new EventEmitter<ViewportTarget>();

  @Output() error = new EventEmitter<string | Error>();
  @Output() hotreload = new EventEmitter<void>();

  private dispose = new EventEmitter<void>();

  constructor(
    private domSanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    document.domain = String(document.domain);
    this._url = domSanitizer.bypassSecurityTrustResourceUrl("about:blank");
  }

  hasValidUrl() {
    return this.base && this.route != undefined && this.route != null;
  }

  _load() {
    if (!this.hasValidUrl()) return;
    try {
      this.getWindow().location.href;
      this.watchHotReloads();
      this.applyDebugStyles();
      this.watchRouter();
      this.findElements();
    } catch (e) {
      if (e instanceof DOMException) {
        console.log(e);
        return this.error.emit("Cannot access to viewport object due to wrong configuration.");
      }
      this.error.emit(e);
    }
  }

  updateSrc() {
    if (!this.hasValidUrl()) return;
    this.dispose.emit();
    this._url = this.domSanitizer.bypassSecurityTrustResourceUrl(`${this.base}${this.route}`);
  }

  @HostListener("window:resize")
  onResize() {
    this.cdr.markForCheck();
  }

  expand(target: ViewportTarget) {
    const height = "80px";
    if (target.element.hasAttribute("expanded")) {
      target.element.style.marginTop = "0px";
      target.element.style.marginBottom = "0px";
      target.element.removeAttribute("expanded");
    } else {
      target.element.style.marginTop = height;
      target.element.style.marginBottom = height;
      target.element.setAttribute("expanded", "");
    }

    this.cdr.markForCheck();
  }

  // TODO: Use constructable stylesheets
  // See: https://developers.google.com/web/updates/2019/02/constructable-stylesheets
  applyDebugStyles(): void {
    const document = this.getDocument();
    document.body.style.margin = "0px";
    document.body.classList.add("composer");
    const styleElement = document.createElement("style");
    styleElement.type = "text/css";
    styleElement.innerHTML = `body,body:first-child,router-outlet+*{display:block;float:left;width:100%}[index]:hover{will-change:opacity;opacity:.9}`;
    document.head.appendChild(styleElement);
  }

  // TODO: Use constructable stylesheets
  // See: https://developers.google.com/web/updates/2019/02/constructable-stylesheets
  applyFont(prevVal: any) {
    if (!this.font) {
      return;
    }

    const document = this.getDocument();
    let linkElem: HTMLLinkElement = document.head.querySelector(
      `link[rel=stylesheet][href="${prevVal && prevVal.src}"]`
    );

    if (!linkElem) {
      linkElem = document.createElement("link");
      linkElem.rel = "stylesheet";
      document.head.appendChild(linkElem);
    }
    linkElem.href = this.font.src;

    document.body.style.fontFamily = this.font.family;
  }

  findElements() {
    const window = this.getWindow();

    function findLastInTView(tView: any) {
      while (tView.next) {
        tView = tView.next;
      }
      return tView.index;
    }

    function findIndexInLView(lView: any[], hostNode: R3Node): number {
      const tView = lView[TVIEW];
      for (let i = HEADER_OFFSET; i < tView.bindingStartIndex; i++) {
        if (!lView[i]) {
          continue;
        }
        if (lView[i][HOST] == hostNode) {
          return i;
        }
      }
    }

    const identifyLContainerView = (lContainerView: any[]) => {
      const index = findIndexInLView(lContainerView[PARENT], lContainerView[HOST]);
      for (let i = 0; i < lContainerView[VIEWS].length; i++) {
        const lView = lContainerView[VIEWS][i];
        identifyLView(lView, {
          parent: index && (index - HEADER_OFFSET).toString(),
          type: "lcontainer"
        });
      }
    };

    const identifyLView = (rootLView: any[], attrs?: {[key: string]: string}) => {
      const tView = rootLView[TVIEW];
      const lastLView = tView.firstChild ? findLastInTView(tView.firstChild) : HEADER_OFFSET;
      for (let i = HEADER_OFFSET; i < tView.bindingStartIndex; i++) {
        if (!tView.data[i] || (tView.data[i] && !("type" in tView.data[i]))) {
          continue;
        }
        const lView = rootLView[i];
        let hostView: R3Node;
        if (!Array.isArray(lView)) {
          hostView = lView;
        } else {
          if (typeof lView[TYPE] === "object") {
            hostView = Array.isArray(lView[HOST]) ? lView[HOST][HOST] : lView[HOST];

            if (Array.isArray(lView[T_HOST].projection)) {
              hostView.setAttribute("hasprojection", "");
            }
          } else if (lView[TYPE] == true) {
            identifyLContainerView(lView);
            continue;
          } else {
            continue;
          }
        }

        if (typeof hostView.setAttribute != "function") {
          continue;
        }

        // A element can be only one element
        // In template
        hostView.setAttribute("index", `${i - HEADER_OFFSET}`);
        if (i == lastLView) {
          hostView.setAttribute("last", "");
        }
        if (i == tView.firstChild.index) {
          hostView.setAttribute("first", "");
        }

        if (attrs) {
          const keys = Object.keys(attrs);
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i],
              value = attrs[key];
            hostView.setAttribute(key, value);
          }
        }
      }
    };
    const zone = this.getZone();
    merge(zone.onStable, this.routeChange, this.hotreload, of(null))
      .pipe(
        map(() => {
          // Find the next element that follows the router-outlet
          // In our case it is a page.
          const page = window.document.querySelector("router-outlet").nextSibling as R3Node;
          if (page && page.__ngContext__) {
            const pageLView = page.__ngContext__[HEADER_OFFSET];
            identifyLView(pageLView);
          }
          this.cdr.markForCheck();
          return page;
        }),
        filter(page => !!page),
        switchMap(page =>
          merge(
            ...(Array.prototype.slice.call(page.querySelectorAll("[index]")) as Array<R3Node>).map(
              element =>
                fromEvent<MouseEvent>(element, "mouseover").pipe(map(event => ({element, event})))
            )
          )
        ),
        takeUntil(this.dispose)
      )
      .subscribe(({event, element}) => {
        event.stopImmediatePropagation();
        const ancestors: Ancestor[] = [];

        forEachAncestor(element, (elem: HTMLElement) => {
          if (elem.getAttribute("parent")) {
            ancestors.unshift({
              index: elem.getAttribute("parent"),
              type:
                element.getAttribute("type") == "lcontainer" ? ViewType.Container : ViewType.Element
            });
          }
        });

        this.zone.run(() => {
          this.target = {
            element,
            ancestors,
            event: event,
            index: element.getAttribute("index"),
            first: element.hasAttribute("first"),
            last: element.hasAttribute("last"),
            hasprojection: element.hasAttribute("hasprojection") || element.localName == "div",
            expandable: element.localName != "div",
            expanded: element.hasAttribute("expanded")
          };
          this.event.emit(this.target);
        });
      });
  }

  watchHotReloads() {
    console.log("watchHotReloads");
    const client = new SockJS(this.base + "/sockjs-node");
    client.onmessage = msg => {
      const data = JSON.parse(msg.data);
      if (data.type == "ok") {
        setTimeout(() => {
          console.log("hot reloaded");
          this.hotreload.emit();
        }, 500);
      }
    };
    this.dispose.toPromise().then(() => client.close());
  }

  watchRouter() {
    merge(this.hotreload, of(null))
      .pipe(flatMap(() => this.getRouter().events))
      .subscribe(event => {
        if (event.constructor.name == "NavigationEnd") {
          this.routeChange.emit(event["url"]);
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.base) {
      this.updateSrc();
    } else if (changes.route) {
      try {
        this.getZone().run(() => this.getRouter().navigate([this.route]));
      } catch (e) {
        this.updateSrc();
      }
    }

    if (changes.font) {
      this.applyFont(changes.font.previousValue);
    }
  }

  ngOnDestroy(): void {
    this.dispose.emit();
  }

  getWindow(): ViewportWindow | null {
    return this.iframe ? (this.iframe.nativeElement.contentWindow as ViewportWindow) : null;
  }

  getDocument(): Document | null {
    return this.iframe ? this.iframe.nativeElement.contentDocument : null;
  }

  getRouter(): Router {
    const window = this.getWindow();
    return this.getInjector().get(window.ng.coreTokens.Router);
  }

  getInjector(): Injector {
    const window = this.getWindow();
    return window.ngRef.injector;
  }

  getZone(): NgZone {
    const window = this.getWindow();
    return this.getInjector().get(window.ng.coreTokens.NgZone);
  }
}
export interface Font {
  src: string;
  family: string;
}
export enum ViewType {
  Element = 1, // When user come over element
  Slot = 2, // When user come over child binding slot
  Container = 3 // When user come over an dynamic inserted view
}

export interface Ancestor {
  type: ViewType;
  index: string;
}

export interface ViewportTarget {
  element: HTMLElement;
  event: MouseEvent;
  ancestors: Ancestor[];
  index: string;
  first: boolean;
  last: boolean;
  hasprojection: boolean;
  expandable: boolean;
  expanded: boolean;
}

interface ViewportWindow extends Window {
  ngRef: NgModuleRef<any>;
  ngDevMode: boolean;
  ng: {
    coreTokens: {
      ApplicationRef: NgProbeToken;
      NgZone: NgProbeToken;
      Router: NgProbeToken;
      component: NgProbeToken;
      [key: string]: NgProbeToken;
    };
    probe: <T>(element: T) => R3Info<T>;
  };
  getAllAngularRootElements: () => R3Node[];
  getAllAngularTestabilities: () => Testability[];
}

interface R3Info<T> {
  nativeNode: T;
  componentInstance: any | null;
  context: any;
  injector: any;
  nodeIndex: number;
}

type R3Node<T = HTMLElement> = T & {
  __ngContext__: any[];
};
