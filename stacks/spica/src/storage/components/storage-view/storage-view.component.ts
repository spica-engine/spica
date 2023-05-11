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
import {DomSanitizer, SafeUrl} from "@angular/platform-browser";
import {tap} from "rxjs/operators";
import {Storage} from "../../interfaces/storage";
import {ImageViewerComponent} from "../image-viewer/image-viewer.component";
import {DefaultViewerComponent} from "../default-viewer/default-viewer.component";
import {VideoViewerComponent} from "../video-viewer/video-viewer.component";
import { TextViewerComponent } from "../text-viewer/text-viewer.component";
import { PdfViewerComponent } from "../pdf-viewer/pdf-viewer.component";

@Component({
  selector: "storage-view",
  template: "<ng-container #viewerContainer></ng-container>",
  styleUrls: ["./storage-view.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StorageViewComponent implements OnChanges,AfterViewInit {
  contentTypeComponentMap = new Map<string, Type<any>>();

  @Input() blob: string | Blob | Storage;
  @Input() autoplay = false;
  contentType: string;
  error: string;
  content: SafeUrl | string;

  @ViewChild("viewerContainer", {read: ViewContainerRef}) viewerContainer: ViewContainerRef;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private cd: ChangeDetectorRef,
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {
    this.contentTypeComponentMap.set("image/.*", ImageViewerComponent);
    this.contentTypeComponentMap.set("video/.*", VideoViewerComponent);
    this.contentTypeComponentMap.set("text/plain|text/javascript", TextViewerComponent);
    this.contentTypeComponentMap.set("application/pdf", PdfViewerComponent);
    this.contentTypeComponentMap.set(".*", DefaultViewerComponent);
  }

  ngAfterViewInit(){
    this.renderViewer();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.blob && changes.blob.currentValue) {
      if (typeof this.blob == "string") {
        const url = this.blob;
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
      } else if (this.blob instanceof Blob) {
        this.contentType = this.blob.type;
        this.content = this.blob
        this.renderViewer();
      } else {
        this.contentType = this.blob.content.type;
        this.content = this.blob.url;
        this.renderViewer();
      }
    }
  }

  renderViewer() {
    if (!this.viewerContainer) {
      return;
    }

    const contentTypeKey = Array.from(this.contentTypeComponentMap.keys()).find(ctype =>
      RegExp(ctype).test(this.contentType)
    );
    const componentType = this.contentTypeComponentMap.get(contentTypeKey);
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentType);

    this.viewerContainer.clear();
    const componentRef = this.viewerContainer.createComponent(componentFactory);

    // try to pass these values dynamically
    componentRef.instance.content = this.content;
    componentRef.instance.error = this.error;
    componentRef.instance.contentType = this.contentType;
    componentRef.instance.autoplay = this.autoplay;

    this.cd.markForCheck();
  }
}
