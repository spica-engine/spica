import { Component, ElementRef, HostBinding, Input, OnChanges, SimpleChanges } from "@angular/core";
import hljs from "highlight.js/lib/highlight";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";

@Component({
  templateUrl: "./code-example.component.html",
  styleUrls: ["./code-example.component.css"]
})
export class CodeExampleComponent implements OnChanges {
  @HostBinding("attr.class") @Input() language: string;

  constructor(private element: ElementRef) {
    hljs.registerLanguage("javascript", javascript);
    hljs.registerLanguage("typescript", typescript);
    hljs.registerLanguage("json", json);
    hljs.registerLanguage("bash", bash);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.language) {
      hljs.highlightBlock(this.element.nativeElement);
    }
  }
}
