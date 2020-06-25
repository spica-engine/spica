import {Directive, Input, OnDestroy} from "@angular/core";

@Directive({
  selector: "code-editor[language='typescript']",
  host: {"(init)": "onEditorInit($event)"}
})
export class TypescriptLanguageDirective implements OnDestroy {
  private disposables: Array<monaco.IDisposable> = [];
  private _editorRef: monaco.editor.IStandaloneCodeEditor;

  @Input("marker")
  set setMarkers(markers: monaco.editor.IMarkerData[]) {
    if (this._editorRef) {
      monaco.editor.setModelMarkers(this._editorRef.getModel(), "typescript", markers);
    } else {
      console.warn("Couldn't set the markers cause the editor was unready.");
    }
  }

  onEditorInit(editorRef: monaco.editor.IStandaloneCodeEditor) {
    this._editorRef = editorRef;
    if (monaco.languages.getLanguages().findIndex(l => l.id == "typescript") == -1) {
      monaco.languages.register({
        id: "typescript",
        extensions: [".ts"]
      });
      import("monaco-languages/release/esm/typescript/typescript").then(m => {
        monaco.languages.setMonarchTokensProvider("typescript", m.language);
        monaco.languages.setLanguageConfiguration("typescript", m.conf);
      });
    }
  }
  ngOnDestroy(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
