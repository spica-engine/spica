import {Directive, Input, OnDestroy} from "@angular/core";

declare var monaco: typeof import("monaco-editor-core");

@Directive({
  selector: "code-editor[language='json']",
  host: {
    "(init)": "onInit($event)"
  }
})
export class JsonLanguageDirective implements OnDestroy {
  onInit() {
    if (!monaco.languages.getLanguages().some(language => language.id == "json")) {
      monaco.languages.register({id: "json"});
    }
  }
}
