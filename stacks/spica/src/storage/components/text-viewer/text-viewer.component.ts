import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  Sanitizer
} from "@angular/core";
import {DomSanitizer} from "@angular/platform-browser";

@Component({
  selector: "text-viewer",
  templateUrl: "./text-viewer.component.html",
  styleUrls: ["./text-viewer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextViewerComponent implements AfterViewInit {
  @Input() content;

  constructor(private sanitizer: DomSanitizer, private cd: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    const fileReader = new FileReader();
    fileReader.onload = e => {
      this.content = e.target.result.toString();
      // it sanitizes the content even this line is missing
      this.content = this.sanitizer.bypassSecurityTrustHtml(this.content)
      this.cd.markForCheck();
    };
    fileReader.readAsText(this.content);
  }
}
