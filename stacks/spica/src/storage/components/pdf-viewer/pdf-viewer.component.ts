import { AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})
export class PdfViewerComponent implements OnInit {
  @Input() content;

  constructor(private sanitizer:DomSanitizer) { }

  ngOnInit(): void {
    this.content = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(this.content));
  }

}
