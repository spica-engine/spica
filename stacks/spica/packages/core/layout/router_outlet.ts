import {DOCUMENT} from "@angular/common";
import {
  Attribute,
  ChangeDetectorRef,
  ComponentFactoryResolver,
  ComponentRef,
  Directive,
  Inject,
  Renderer2,
  ViewContainerRef,
  EnvironmentInjector // Import EnvironmentInjector
} from "@angular/core";
import {ActivatedRoute, ChildrenOutletContexts, RouterOutlet} from "@angular/router";
import {DEFAULT_LAYOUT} from "./config";
import {Scheme, SchemeObserver} from "./scheme.observer";

@Directive({selector: "layout-router-outlet", exportAs: "outlet"})
export class LayoutRouterOutlet extends RouterOutlet {
  activatedLayout: ComponentRef<{}>;

  constructor(
    private _location: ViewContainerRef,
    _parentContexts: ChildrenOutletContexts,
    @Attribute("name") _name: string,
    _changeDetector: ChangeDetectorRef,
    private _resolver: ComponentFactoryResolver,
    @Inject(DEFAULT_LAYOUT) private defaultLayout: any,
    renderer: Renderer2,
    schemeObserver: SchemeObserver,
    @Inject(DOCUMENT) private document: any,
    injector: EnvironmentInjector // Inject EnvironmentInjector
  ) {
    super(_parentContexts, _location, _name, _changeDetector, injector); // Pass EnvironmentInjector to super()

    // We did not unsubscribe this because our app has only one outlet
    // TODO(thesayyn): reconsider this
    schemeObserver.observe(Scheme.Dark).subscribe(isDark => {
      const root = this.document.querySelector(":root");
      if (isDark) {
        renderer.addClass(root, "dark");
      } else {
        renderer.removeClass(root, "dark");
      }
    });
  }

  activateWith(activatedRoute: ActivatedRoute, resolver: ComponentFactoryResolver | null) {
    super.activateWith(activatedRoute, resolver);
    if (activatedRoute.snapshot.data.layout === false && this.activatedLayout) {
      this._location.remove(this._location.indexOf(this.activatedLayout.hostView));
      this.activatedLayout = null;
    }

    if (activatedRoute.snapshot.data.layout !== false) {
      const activated: ComponentRef<{}> = (this as any).activated;

      if (!this.activatedLayout) {
        resolver = resolver || this._resolver;
        const factory = resolver.resolveComponentFactory(this.defaultLayout);
        this.activatedLayout = factory.create(this._location.injector);
        this._location.insert(this.activatedLayout.hostView);
      }
      this.activatedLayout.location.nativeElement
        .querySelector("[slot=content]")
        .appendChild(activated.location.nativeElement);
      this.activatedLayout.changeDetectorRef.markForCheck();
    }
  }
}
