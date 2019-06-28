import {
  Attribute,
  ChangeDetectorRef,
  ComponentFactoryResolver,
  ComponentRef,
  Directive,
  Inject,
  ViewContainerRef
} from "@angular/core";
import {ActivatedRoute, ChildrenOutletContexts, RouterOutlet} from "@angular/router";

import {DEFAULT_LAYOUT} from "./config";

@Directive({selector: "layout-router-outlet", exportAs: "outlet"})
export class LayoutRouterOutlet extends RouterOutlet {
  activatedLayout: ComponentRef<{}>;
  constructor(
    private _location: ViewContainerRef,
    _parentContexts: ChildrenOutletContexts,
    private _resolver: ComponentFactoryResolver,
    @Attribute("name") _name: string,
    _changeDetector: ChangeDetectorRef,
    @Inject(DEFAULT_LAYOUT) private defaultLayout: any
  ) {
    super(_parentContexts, _location, _resolver, name, _changeDetector);
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
