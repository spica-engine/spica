import {Directive} from "@angular/core";

@Directive({
  selector: "code-editor[language='handlebars']",
  host: {"(init)": "onEditorInit($event)"}
})
export class HandlebarsLanguageDirective {
  onEditorInit() {
    if (monaco.languages.getLanguages().findIndex(l => l.id == "handlebars") == -1) {
      monaco.languages.register({
        id: "handlebars",
        extensions: [".handlebars"]
      });
      import("monaco-languages/release/esm/handlebars/handlebars").then(m => {
        monaco.languages.setMonarchTokensProvider("handlebars", m.language);
        monaco.languages.setLanguageConfiguration("handlebars", m.conf);
      });
    }
  }
}
