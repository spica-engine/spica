import {Directive, OnDestroy} from "@angular/core";

@Directive({
  selector: "code-editor[language='json']",
  host: {
    "(onInit)": "onInit()"
  }
})
export class JsonLanguageDirective implements OnDestroy {
  private disposables: Array<any> = [];

  onInit() {
    const snippetProvider = {
      provideCompletionItems: () => {
        return import("./suggestions").then(({suggestions}) => {
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

    this.disposables.push(monaco.languages.registerCompletionItemProvider("json", snippetProvider));

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [
        {
          uri: "my_schema",
          schema: {
            type: "object",
            properties: {
              p1: {
                type: "number",
                enum: [1, 2]
              },
              p2: {
                type: "relation"
              }
            }
          }
        }
      ]
    });
  }

  ngOnDestroy(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
