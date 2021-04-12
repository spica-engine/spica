/// <reference path="../../../../../../node_modules/monaco-editor/monaco.d.ts" />
import {Directive, Input, OnChanges, OnDestroy, SimpleChanges} from "@angular/core";
import {fromEvent} from "rxjs";
import {map, take} from "rxjs/operators";

declare var monaco: typeof import("monaco-editor-core");

@Directive({
  selector: "function-code-editor[language]",
  host: {"(onInit)": "_editorReady($event)"},
  exportAs: "language"
})
export class LanguageDirective implements OnChanges, OnDestroy {
  @Input() language: string;
  private editor: any;
  private disposables: Array<any> = [];
  private formatter: Worker;

  format() {
    return this.editor.getAction("editor.action.formatDocument").run();
  }

  _editorReady(editorRef) {
    this.editor = editorRef;

    this.updateLanguage();

    this.formatter = new Worker("./format.worker", {type: "module", name: "format-worker"});
    const format = fromEvent<MessageEvent>(this.formatter, "message").pipe(
      map(event => event.data as string)
    );
    const formatProvider = {
      provideDocumentFormattingEdits: (model, options) => {
        this.formatter.postMessage({
          value: model.getValue(),
          tabSize: options.tabSize,
          useSpaces: options.insertSpaces
        });
        return format
          .pipe(take(1))
          .pipe(
            map(formattedText => {
              const model = editorRef.getModel();
              const lastLine = model.getLineCount() - 1;
              const lastColumn = model.getLinesContent()[lastLine].length;
              return [
                {
                  range: {
                    startLineNumber: 0,
                    startColumn: 0,
                    endLineNumber: lastLine + 1,
                    endColumn: lastColumn + 1
                  },
                  text: formattedText
                }
              ];
            })
          )
          .toPromise();
      }
    };
    this.disposables.push(
      monaco.languages.registerDocumentFormattingEditProvider("typescript", formatProvider)
    );
    this.disposables.push(
      monaco.languages.registerDocumentFormattingEditProvider("javascript", formatProvider)
    );

    const snippetProvider = {
      provideCompletionItems: () => {
        return import("./snippets").then(({suggestions}) => {
          return {
            suggestions: suggestions.map(suggestion => {
              return {
                label: suggestion.label,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: suggestion.text,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: suggestion.description
              };
            })
          };
        }) as any;
      }
    };
    this.disposables.push(
      monaco.languages.registerCompletionItemProvider("typescript", snippetProvider)
    );
    this.disposables.push(
      monaco.languages.registerCompletionItemProvider("javascript", snippetProvider)
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.language && this.editor) {
      this.updateLanguage();
    }
  }

  updateLanguage() {
    monaco.editor.setModelLanguage(this.editor.getModel(), this.language);
  }

  ngOnDestroy(): void {
    if (this.formatter) {
      this.formatter.terminate();
    }
    this.disposables.forEach(d => d.dispose());
  }
}
