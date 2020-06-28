import {Directive} from "@angular/core";

@Directive({
  selector: "code-editor[language='handlebars']",
  host: {"(init)": "onEditorInit()"}
})
export class HandlebarsLanguageDirective {
  async onEditorInit() {
    if (monaco.languages.getLanguages().findIndex(l => l.id == "handlebars") == -1) {
      monaco.languages.register({id: "handlebars", extensions: [".handlebars"]});
      const module = await import("monaco-languages/release/esm/handlebars/handlebars");
      monaco.languages.setMonarchTokensProvider("handlebars", module.language);
      monaco.languages.setLanguageConfiguration("handlebars", module.conf);
    }
  }
}
