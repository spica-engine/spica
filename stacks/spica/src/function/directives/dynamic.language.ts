import {Directive, Input, OnChanges, OnDestroy, OnInit, SimpleChanges} from "@angular/core";

@Directive({
  selector: "code-editor[language]",
  host: {"(onInit)": "_editorReady($event)"},
  exportAs: "language"
})
export class LanguageDirective implements OnChanges, OnDestroy {
  @Input() language: string;
  private disposables: Array<any> = [];

  private editor: monaco.editor.IStandaloneCodeEditor;

  format() {
    return this.editor.getAction("editor.action.formatDocument").run();
  }

  _editorReady(_editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = _editor;

    this.updateLanguage();

    const snippetProvider = {
      provideCompletionItems: () => {
        return import("../statics/snippets").then(({suggestions}) => {
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
    this.disposables.forEach(d => d.dispose());
  }
}
