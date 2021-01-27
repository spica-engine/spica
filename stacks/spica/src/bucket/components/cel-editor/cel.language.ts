import {Directive, OnDestroy, Input, OnInit} from "@angular/core";

declare var monaco: typeof import("monaco-editor-core");

@Directive({
  selector: "code-editor[language='cel']",
  host: {
    "(init)": "onInit($event)"
  }
})
export class CelLanguageDirective implements OnDestroy {
  private disposables: Array<any> = [];
  @Input("properties") bucketProperties: object;

  async onInit(event) {
    // prevent to register language twice from same page, different components.
    // it will cause to display all snippets twice
    if(event._id == 2){
      return;
    }
    const {configuration, language} = await import("./cel.syntax");
    monaco.languages.register({id: "cel"});
    monaco.languages.setLanguageConfiguration("cel", configuration);
    monaco.languages.setMonarchTokensProvider("cel", language);

    this.disposables.push(
      monaco.languages.registerCompletionItemProvider("cel", {
        provideCompletionItems: (model, position) => {
          const textUntilPosition = model.getValueInRange({
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

          let suggestions = [];
          suggestions = [
            // {
            //   label: "example",
            //   kind: monaco.languages.CompletionItemKind.Snippet,
            //   documentation: "Basic example to write rule",
            //   insertText: `document.${Object.keys(this.bucketProperties)[0]} == '\${1:test}'`,
            //   insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            //   range: range
            // },
            {
              label: "document",
              kind: monaco.languages.CompletionItemKind.Field,
              documentation: "Bucket document",
              insertText: "document.${1:}",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range
            },
            {
              label: "auth",
              kind: monaco.languages.CompletionItemKind.Field,
              documentation: "User of the request",
              insertText: "auth.${1:}",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range
            },
            {
              label: "has",
              kind: monaco.languages.CompletionItemKind.Function,
              documentation: "Returns true if field exists",
              insertText: "has(document.${1:})",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range
            },
            {
              label: "some",
              kind: monaco.languages.CompletionItemKind.Function,
              documentation:
                "Returns true if first argument includes at least one of rest arguments",
              insertText: "some(document.${1:},'${2:custom_value}')",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range
            },
            {
              label: "every",
              kind: monaco.languages.CompletionItemKind.Function,
              documentation: "Returns true if first argument includes all of rest arguments",
              insertText: "every(document.${1:},'${2:custom_value}')",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range
            },
            {
              label: "equal",
              kind: monaco.languages.CompletionItemKind.Function,
              documentation: "Returns true if first argument equals the rest of arguments",
              insertText: "equal(document.${1:},'${2:custom_value}')",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range
            },
            {
              label: "regex",
              kind: monaco.languages.CompletionItemKind.Function,
              documentation:
                "Returns true if first argument match with second argument, third argument is the regex flags",
              insertText: "regex(document.${1:},'${2:custom_value}','${3:gm}')",
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range
            }
          ];

          if (textUntilPosition.match(/document.$/)) {
            suggestions = Object.entries(this.bucketProperties).map(([name, definition]) => {
              return {
                label: name,
                kind: monaco.languages.CompletionItemKind.Field,
                documentation: definition.description,
                insertText: name,
                range: range
              };
            });
          } else if (textUntilPosition.match(/auth.$/)) {
            suggestions = [
              {
                label: "_id",
                kind: monaco.languages.CompletionItemKind.Field,
                documentation: "Identity id, type: string",
                insertText: "_id",
                range: range
              },
              {
                label: "identifier",
                kind: monaco.languages.CompletionItemKind.Field,
                documentation: "Identifier, type: string",
                insertText: "identifier",
                range: range
              },
              {
                label: "policies",
                kind: monaco.languages.CompletionItemKind.Field,
                documentation: "Policies of identifier, type: string array",
                insertText: "policies",
                range: range
              }
            ];
          }

          return {
            suggestions: suggestions
          };
        }
      })
    );

  }

  ngOnDestroy(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
