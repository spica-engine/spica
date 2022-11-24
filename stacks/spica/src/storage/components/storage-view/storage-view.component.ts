import {HttpClient} from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges
} from "@angular/core";
import {DomSanitizer, SafeUrl} from "@angular/platform-browser";
import {StorageService} from "@spica-client/storage/storage.service";
import {Observable} from "rxjs";
import {distinctUntilChanged, filter, map, switchMap, takeWhile, tap} from "rxjs/operators";
import {Storage} from "../../interfaces/storage";

@Component({
  selector: "storage-view",
  templateUrl: "./storage-view.component.html",
  styleUrls: ["./storage-view.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StorageViewComponent implements OnChanges {
  @Input() blob: string | Blob | Storage;
  @Input() autoplay = false;
  displayableTypes: RegExp = /image\/.*?|video\/.*?/;
  ready: boolean = false;
  error: string;
  contentType: string;
  content: SafeUrl | string;

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private element: ElementRef<Element>,
    private storage: StorageService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.blob && changes.blob.currentValue) {
      this.error = undefined;
      if (this.blob instanceof Blob) {
        this.onDownloaded(this.blob);
      } else if (typeof this.blob == "string") {
        this.download(this.blob);
      } else {
        // set content type before download process completion,
        // otherwise 'object cannot be viewed' title will appear until the download is completed
        this.contentType = this.blob.content.type;
        this.download(this.blob.url);
      }
    }
  }

  onDownloaded(blob: Blob) {
    this.contentType = blob.type;
    this.ready = !this.displayableTypes.test(this.contentType);
    this.content = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob));
  }

  download(url) {
    this.ready = false;
    this.observe()
      .pipe(
        switchMap(() => this.storage.download(url, false)),
        tap(r => (this.contentType = r.type)),
        takeWhile(r => this.displayableTypes.test(r.type))
      )
      .subscribe({
        next: r => {
          this.onDownloaded(r);
          this.ready = true;
          this.cd.markForCheck();
        },
        error: event => {
          this.ready = true;
          this.error = event.error.type;
          this.cd.markForCheck();
        },
        complete: () => {
          this.ready = !this.displayableTypes.test(this.contentType);
          this.cd.markForCheck();
        }
      });
  }

  viewError(event: MediaError) {
    this.error = event.message;
  }

  private observe() {
    return new Observable<IntersectionObserverEntry[]>(observer => {
      const iobserver = new IntersectionObserver(entry => observer.next(entry));
      iobserver.observe(this.element.nativeElement);
      return () => iobserver.disconnect();
    }).pipe(
      map(r => r.some(r => r.isIntersecting)),
      distinctUntilChanged(),
      filter(r => r)
    );
  }
}
