import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit
} from "@angular/core";
import {DomSanitizer} from "@angular/platform-browser";

@Component({
  selector: "pdf-viewer",
  templateUrl: "./pdf-viewer.component.html",
  styleUrls: ["./pdf-viewer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PdfViewerComponent implements OnInit {
  @Input() content;
  @Input() controls: boolean;

  constructor(private sanitizer: DomSanitizer, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    const resourceUrl =
      URL.createObjectURL(this.content) + "#toolbar=" + (this.controls ? "1" : "0");
    this.content = this.sanitizer.bypassSecurityTrustResourceUrl(resourceUrl);
  }
}
