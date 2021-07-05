import {Directive, Input, OnDestroy} from "@angular/core";

@Directive({
  selector: "code-editor[language='json']",
  host: {
    "(onInit)": "onInit()"
  }
})
export class JsonLanguageDirective implements OnDestroy {
  private disposables: Array<any> = [];

  @Input("properties") bucketProperties: object = {};

  onInit() {
    const snippetProvider = {
      triggerCharacters: ["\n", '"'],
      provideCompletionItems: async (model, position) => {
        let suggestions: any[] = [];

        const examples: any = await import("./suggestions").then(({examples}) =>
          examples.map(e => {
            return {
              label: e.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: e.text,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: e.description
            };
          })
        );

        let typedText = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        typedText = typedText.length ? typedText.trim() : "";

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const fields = Object.entries(this.bucketProperties)
          .concat([["_id", {description: "Document id"}]])
          .map(([name, definition]) => {
            return {
              label: name,
              kind: monaco.languages.CompletionItemKind.Field,
              documentation: definition.description,
              description: definition.description,
              insertText: typedText.endsWith('"') || typedText.endsWith("'") ? name : `"${name}": `,
              text: name,
              range: range
            };
          });

        if (!typedText.length) {
          suggestions = examples;
        } else {
          suggestions = fields;
        }

        return {
          suggestions
        };
      }
    };

    this.disposables.push(monaco.languages.registerCompletionItemProvider("json", snippetProvider));
  }

  ngOnDestroy(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
