import {Directive} from "@angular/core";

declare var monaco: typeof import("monaco-editor-core");

@Directive({
  selector: "code-editor[language='cel']",
  host: {
    "(init)": "onInit()"
  }
})
export class CelLanguageDirective {
  async onInit() {
    const {configuration, language} = await import("./cel.syntax");
    monaco.languages.register({id: "cel"});
    monaco.languages.setLanguageConfiguration("cel", configuration);
    monaco.languages.setMonarchTokensProvider("cel", language);
  }
}
