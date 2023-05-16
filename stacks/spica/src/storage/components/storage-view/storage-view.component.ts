import {HttpClient} from "@angular/common/http";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentFactoryResolver,
  Input,
  OnChanges,
  SimpleChanges,
  Type,
  ViewChild,
  ViewContainerRef
} from "@angular/core";
import {SafeUrl} from "@angular/platform-browser";
import {tap} from "rxjs/operators";
import {Storage} from "../../interfaces/storage";
import {ImageViewerComponent} from "../image-viewer/image-viewer.component";
import {DefaultViewerComponent} from "../default-viewer/default-viewer.component";
import {VideoViewerComponent} from "../video-viewer/video-viewer.component";
import {TextViewerComponent} from "../text-viewer/text-viewer.component";
import {PdfViewerComponent} from "../pdf-viewer/pdf-viewer.component";
import {ZipViewerComponent} from "../zip-viewer/zip-viewer.component";
import {TableViewerComponent} from "../table-viewer/table-viewer.component";

@Component({
  selector: "storage-view",
  template: "<ng-container #viewerContainer></ng-container>",
  styleUrls: ["./storage-view.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StorageViewComponent implements OnChanges {
  contentTypeComponentMap = new Map<string, Type<any>>();

  @Input() blob: string | Blob | Storage;
  @Input() autoplay = false;
  @Input() controls = true;

  contentType: string;
  error: string;
  content: SafeUrl | string;

  @ViewChild("viewerContainer", {read: ViewContainerRef, static: true})
  private viewerContainer: ViewContainerRef;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private cd: ChangeDetectorRef,
    private http: HttpClient
  ) {
    this.contentTypeComponentMap.set("image/.*", ImageViewerComponent);
    this.contentTypeComponentMap.set("video/.*", VideoViewerComponent);
    this.contentTypeComponentMap.set(
      "text/plain|text/javascript|application/json",
      TextViewerComponent
    );
    this.contentTypeComponentMap.set("application/pdf", PdfViewerComponent);
    this.contentTypeComponentMap.set("application/zip", ZipViewerComponent);
    this.contentTypeComponentMap.set(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet|text/csv",
      TableViewerComponent
    );
    this.contentTypeComponentMap.set(".*", DefaultViewerComponent);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!(changes.blob || changes.blob.currentValue)) {
      return;
    }

    if (this.isBlob(this.blob)) {
      this.contentType = this.blob.type;
      this.content = this.blob;
      this.renderViewer();
      return;
    }

    let url;

    if (this.isStorage(this.blob)) {
      url = this.blob.url;
    } else if (this.isUrl(this.blob)) {
      url = this.blob;
    } else {
      console.error("Unknown object received!");
      return;
    }

    this.http
      .get(url, {responseType: "blob"})
      .pipe(tap(r => (this.contentType = r.type)))
      .subscribe({
        next: r => {
          this.content = r;
          this.renderViewer();
        },
        error: event => {
          this.error = event.error.type;
          this.renderViewer();
        }
      });
  }

  isBlob(object: string | Blob | Storage): object is Blob {
    return object instanceof Blob;
  }

  isStorage(object: string | Blob | Storage): object is Storage {
    return typeof object == "object" && Object.keys(object).includes("url");
  }

  isUrl(object: string | Blob | Storage): object is string {
    return typeof object == "string";
  }

  renderViewer() {
    this.viewerContainer.clear();

    const contentTypeKey = Array.from(this.contentTypeComponentMap.keys()).find(ctype =>
      RegExp(ctype).test(this.contentType)
    );
    const componentType = this.contentTypeComponentMap.get(contentTypeKey);
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentType);

    const componentRef = this.viewerContainer.createComponent(componentFactory);

    // try to pass these values dynamically
    componentRef.instance.content = this.content;
    componentRef.instance.error = this.error;
    componentRef.instance.contentType = this.contentType;
    componentRef.instance.autoplay = this.autoplay;
    componentRef.instance.controls = this.controls;

    this.cd.markForCheck();
  }
}
