import {Directive, Input, OnChanges, OnDestroy, OnInit, SimpleChanges} from "@angular/core";

@Directive({
  selector: "code-editor[[language]='javascript']"
})
export class LanguageDirective implements OnInit, OnChanges, OnDestroy {
  @Input() language: string;
  private disposables: Array<any> = [];

  constructor(){console.log("asda")}

  format() {
    return // this.editor.getAction("editor.action.formatDocument").run();
  }

  async ngOnInit() {

    if (typeof monaco == "undefined") {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

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
    if (changes.language && typeof monaco != "undefined") {
      this.updateLanguage();
    }
  }

  updateLanguage() {
    monaco.editor.setModelLanguage(monaco.editor.getModels()[0], this.language);
  }

  ngOnDestroy(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
