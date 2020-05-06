import {Directive, EventEmitter, Input, NgZone, OnDestroy, Output} from "@angular/core";
import {LanguageService} from "./language.service";

@Directive({
  selector: "code-editor[language='typescript']",
  host: {"(init)": "onEditorInit($event)"}
})
export class TypescriptLanguageDirective implements OnDestroy {
  @Output() run = new EventEmitter();
  private disposables: Array<monaco.IDisposable> = [];
  private _editorRef: monaco.editor.IStandaloneCodeEditor;

  constructor(private ls: LanguageService, private zone: NgZone) {}

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

    editorRef.onDidChangeModelContent(event => {
      if (!event.isFlush) {
        this.ls.notify("documentChanges", event.changes);
      }
    });

    const runCommand = editorRef.addCommand(monaco.KeyMod.Alt, (_, {handler}) =>
      this.zone.run(() => this.run.emit(handler))
    );

    const subscription = this.ls
      .fromEvent<any[]>("diagnostics")
      .subscribe(diagnostics =>
        monaco.editor.setModelMarkers(editorRef.getModel(), "typescript", diagnostics)
      );

    this.disposables.push(
      monaco.languages.registerFoldingRangeProvider("typescript", {
        provideFoldingRanges: () => {
          return this.ls.request<any[]>("foldingRange").then(ranges =>
            ranges.map(range => ({
              start: range.start,
              end: range.end,
              kind: new monaco.languages.FoldingRangeKind(range.kind)
            }))
          );
        }
      }),
      monaco.languages.registerHoverProvider("typescript", {
        provideHover: (model, position) => {
          return this.ls.request<any>("hover", {
            lineNumber: position.lineNumber,
            column: position.column
          });
        }
      }),
      monaco.languages.registerCodeLensProvider("typescript", {
        provideCodeLenses: () => {
          return this.ls.request("codeLenses", runCommand);
        }
      }),
      monaco.languages.registerCompletionItemProvider("typescript", {
        provideCompletionItems: async (model, position, context) => {
          return this.ls
            .request<any[]>("completions", {
              lineNumber: position.lineNumber,
              column: position.column,
              triggerCharacter: context.triggerCharacter
            })
            .then(suggestions => ({suggestions, incomplete: false}));
        }
      }),
      {dispose: () => subscription.unsubscribe()}
    );
  }
  ngOnDestroy(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
