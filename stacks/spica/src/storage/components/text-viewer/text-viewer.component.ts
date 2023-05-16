import {
  AfterViewInit,
  ChangeDetectionStrategy,
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
})
export class TextViewerComponent implements OnInit {
  @Input() content;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    const fileReader = new FileReader();
    fileReader.onload = e => {
      let readFile = e.target.result.toString();

      this.content = this.sanitizer.bypassSecurityTrustHtml(readFile);
    };
    fileReader.readAsText(this.content);
  }
}
