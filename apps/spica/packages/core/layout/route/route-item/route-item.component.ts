import {ComponentType} from "@angular/cdk/portal";
import {
  Component,
  ComponentFactoryResolver,
  Input,
  OnInit,
  ViewChild,
  ViewContainerRef
} from "@angular/core";
import {MatLegacyDialog as MatDialog} from "@angular/material/legacy-dialog";
import {Title} from "@angular/platform-browser";
import {Route} from "@spica-client/core/route";
import {BehaviorSubject} from "rxjs";

@Component({
  selector: "route-item",
  templateUrl: "./route-item.component.html",
  styleUrls: ["./route-item.component.scss"]
})
export class RouteItemComponent implements OnInit {
  constructor(
    private titleService: Title,
    private _dialog: MatDialog,
    private resolver: ComponentFactoryResolver
  ) {}

  @ViewChild("placeholder", {read: ViewContainerRef, static: true})
  public placeholder!: ViewContainerRef;

  @Input() moreTemplate: ComponentType<any>;
  @Input() route: Route;
  @Input() currentCategory: BehaviorSubject<any>;

  ngOnInit() {}

  setTitle(title: string) {
    this.titleService.setTitle(`${this.currentCategory.value.category} | ${title}`);
  }

  openModalFromSidenav(component) {
    this._dialog.open(component, {
      autoFocus: false
    });
  }
  checkPathIsLink(path) {
    return typeof path == "string";
  }
  ngAfterViewInit(): void {
    if (!this.moreTemplate) return;
    this.placeholder.clear();
    const componentFactory = this.resolver.resolveComponentFactory(this.moreTemplate);
    const component = this.placeholder.createComponent(componentFactory);
    component.instance.route = this.route;
  }
}
