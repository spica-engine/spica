import {Directive, OnDestroy, Input} from "@angular/core";

declare var monaco: typeof import("monaco-editor-core");

// this global state will prevent to registering same registerCompletionItemProvider twice from same page
// if we remove this, completions will be displayed twice.
let hasRegistered = false;

@Directive({
  selector: "code-editor[language='cel']",
  host: {
    "(init)": "onInit($event)"
  }
})
export class CelLanguageDirective implements OnDestroy {
  private disposables: Array<any> = [];
  @Input("properties") bucketProperties: object;

  async onInit() {
    if (hasRegistered) {
      return;
    }

    hasRegistered = true;

    if (!monaco.languages.getLanguages().some(language => language.id == "cel")) {
      monaco.languages.register({id: "cel"});

      const {configuration, language} = await import("./cel.syntax");
      monaco.languages.setLanguageConfiguration("cel", configuration);
      monaco.languages.setMonarchTokensProvider("cel", language);
    }

    this.disposables.push(
      monaco.languages.registerCompletionItemProvider("cel", {
        triggerCharacters: ["."],
        provideCompletionItems: async (model, position) => {
          const typedText = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };

          return {
            suggestions: await this.suggestionBuilder(typedText, range)
          };
        }
      })
    );
  }

  async suggestionBuilder(
    typedText: string,
    range: {
      startLineNumber: number;
      endLineNumber: number;
      startColumn: number;
      endColumn: number;
    }
  ) {
    const suggestions = [];

    if (typedText.match(/(^|[^\w.])auth\.$/)) {
      const {auths} = await import("./suggestions");

      suggestions.push(
        ...auths.map(suggestion => {
          return {
            label: suggestion.label,
            kind: monaco.languages.CompletionItemKind.Field,
            documentation: suggestion.description,
            insertText: suggestion.text,
            range: range
          };
        })
      );
    } else if (typedText.match(/(^|[^\w.])document\.$/)) {
      suggestions.push(
        ...Object.entries({...this.bucketProperties, _id: {description: "Document id"}}).map(
          ([name, definition]) => {
            return {
              label: name,
              kind: monaco.languages.CompletionItemKind.Field,
              documentation: definition.description,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              insertText: name,
              range: range
            };
          }
        )
      );
    } else if (typedText.match(/(^|[^.])$/)) {
      const {baseFields, functions, examples} = await import("./suggestions");

      suggestions.push(
        ...baseFields.map(suggestion => {
          return {
            label: suggestion.label,
            kind: monaco.languages.CompletionItemKind.Field,
            documentation: suggestion.description,
            insertText: suggestion.text,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range
          };
        })
      );

      suggestions.push(
        ...functions.map(suggestion => {
          return {
            label: suggestion.label,
            kind: monaco.languages.CompletionItemKind.Function,
            documentation: suggestion.description,
            detail: suggestion.detail,
            insertText: suggestion.text,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range
          };
        })
      );

      suggestions.push(
        ...examples.map(suggestion => {
          return {
            label: suggestion.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: suggestion.detail,
            insertText: suggestion.text,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range
          };
        })
      );
    }

    return suggestions;
  }

  ngOnDestroy(): void {
    this.disposables.forEach(d => d.dispose());
    // we need to re-register completion item provider after it has been disposed.
    hasRegistered = false;
  }
}
