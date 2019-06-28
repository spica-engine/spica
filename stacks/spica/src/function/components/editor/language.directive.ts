import {Directive, EventEmitter, NgZone, OnDestroy, Output} from "@angular/core";
import {LanguageService} from "./language.service";

@Directive({selector: "function-editor[language]", host: {"(init)": "onEditorInit($event)"}})
export class LanguageDirective implements OnDestroy {
  @Output() run = new EventEmitter();
  private disposables: Array<monaco.IDisposable> = [];

  constructor(private ls: LanguageService, private zone: NgZone) {}

  onEditorInit(editorRef: monaco.editor.IStandaloneCodeEditor) {
    if (monaco.languages.getLanguages().findIndex(l => l.id == "typescript") == -1) {
      monaco.languages.register({
        id: "typescript",
        extensions: [".ts"],
        aliases: ["typescript"],
        mimetypes: ["text/typescript"]
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
