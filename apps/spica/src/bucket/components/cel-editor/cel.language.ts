import {Directive, OnDestroy, Input, OnInit} from "@angular/core";

// this global state will prevent to registering same registerCompletionItemProvider twice from same page
// if we remove this, completions will be displayed twice.
let hasRegistered = false;

@Directive({
  selector: "code-editor[language='cel']",
  host: {"(onInit)": "init()"}
})
export class CelLanguageDirective implements OnDestroy {
  private disposables: Array<any> = [];
  @Input("properties") bucketProperties: object = {};
  @Input() context: "rule" | "filter" = "rule";

  async init() {
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
    const {fields, macros} = await import("./suggestions").then(suggestions =>
      this.prepareSuggestions(suggestions, range)
    );

    const document = fields.find(field => field.label == "document");

    const auth = fields.find(field => field.label == "auth");

    const documentTyped = typedText.match(/(^|[^\w.])document\.$/);
    const authTyped = typedText.match(/(^|[^\w.])auth\.$/);
    const typedNone = typedText.match(/(^|[^.])$/);

    if (documentTyped) {
      return document.properties;
    }

    if (authTyped && this.context == "rule") {
      return auth.properties;
    }

    if (typedNone) {
      const suggestions = [];

      suggestions.push(...macros);

      suggestions.push(document);
      suggestions.push(...document.examples);

      if (this.context == "rule") {
        suggestions.push(auth);
        suggestions.push(...auth.examples);
      }

      return suggestions;
    }

    return [];
  }

  prepareSuggestions(suggestions: any, range: any) {
    const result: any = {};

    result.macros = suggestions.macros.map(macro => {
      return {
        label: macro.label,
        kind: monaco.languages.CompletionItemKind.Function,
        documentation: macro.description,
        detail: macro.detail,
        insertText: macro.text,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: range
      };
    });

    result.fields = suggestions.fields.map(field => {
      const mappedExamples = field.examples.map(example => {
        return {
          label: example.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: example.detail,
          insertText: example.text,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range
        };
      });

      if (field.label == "document") {
        const mappedBucketProperties = Object.entries(this.bucketProperties)
          .concat([["_id", {description: "Document id"}]])
          .map(([name, definition]) => {
            return {
              label: name,
              description: definition.description,
              text: name
            };
          });
        field.properties = mappedBucketProperties;
      }

      const mappedProperties = field.properties.map(property => {
        return {
          label: property.label,
          kind: monaco.languages.CompletionItemKind.Field,
          documentation: property.description,
          insertText: property.text,
          range: range
        };
      });

      const mappedField = {
        label: field.label,
        kind: monaco.languages.CompletionItemKind.Field,
        documentation: field.description,
        insertText: field.text,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: range,
        properties: mappedProperties,
        examples: mappedExamples
      };

      return mappedField;
    });

    return result;
  }

  ngOnDestroy(): void {
    this.disposables.forEach(d => d.dispose());
    // we need to re-register completion item provider after it has been disposed.
    hasRegistered = false;
  }
}
