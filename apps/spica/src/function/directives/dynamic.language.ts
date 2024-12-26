import {
  Directive,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges
} from "@angular/core";
import {BehaviorSubject, merge, Subscription} from "rxjs";
import {debounceTime, map, take} from "rxjs/operators";

interface HandlerData {
  handler: string;
  index: string;
}

@Directive({
  selector: "code-editor[language]",
  host: {"(onInit)": "_editorReady($event)"},
  exportAs: "language"
})
export class LanguageDirective implements OnChanges, OnDestroy {
  @Input() language: string;
  @Input() dependencies: {name: string; version: string; types: {[path: string]: string}}[] = [];

  @Input("ngModel") index: string = "";

  @Output("handlers") handlerEmitter = new EventEmitter<string[]>();
  @Output("debouncedChange") debouncedChangeEmitter = new EventEmitter<string[]>();

  private disposables: Array<any> = [];

  private extraLibDisposables = [];

  private editor: monaco.editor.IStandaloneCodeEditor;

  // function declaration
  // default functionDeclaration
  // function expression
  private handlersInIndexRegex = new RegExp(
    //prettier-ignore
    /^\s*export +(async +)?function\s+(\w+)\s*\(|^\s*export +(default)\s+(async +)?function\s*\(|^\s*export +(let|var|const)\s*(\w+)\s*=\s*(function\s*)?\(/,
    "gm"
  );

  private onIndexChange$ = new BehaviorSubject<string>(this.index);
  private onIndexChangeSubs: Subscription;

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

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
    });

    this.upsertDependencies();

    const sourceObservable = this.onIndexChange$.asObservable();

    this.onIndexChangeSubs = merge(
      sourceObservable.pipe(take(1)),
      sourceObservable.pipe(
        debounceTime(2000),
        map(index => ({handler: "emitHandlers", index}))
      ),
      sourceObservable.pipe(
        debounceTime(10000),
        map(index => ({handler: "debouncedChange", index}))
      )
    ).subscribe((data: string | HandlerData) => {
      if (typeof data === "string") {
        return;
      }
      switch (data.handler) {
        case "emitHandlers":
          this.emitHandlers(data.index);
          break;
        case "debouncedChange":
          this.debouncedChangeEmitter.emit();
          break;
      }
    });
  }

  // https://github.com/Microsoft/monaco-editor/issues/926#issuecomment-398689036
  updateModelUri(currentModel: any) {
    const uri = monaco.Uri.parse("file:///main.tsx");

    const value = currentModel.getValue();

    const existingModel = monaco.editor.getModel(uri);
    if (existingModel) {
      existingModel.dispose();
    }

    const updatedModel: any = monaco.editor.createModel(value, this.language, uri);

    let cm2 = updatedModel._commandManager;
    let cm1 = currentModel._commandManager;
    let temp;

    // SWAP currentOpenStackElement
    temp = cm2.currentOpenStackElement;
    cm2.currentOpenStackElement = cm1.currentOpenStackElement;
    cm1.currentOpenStackElement = temp;

    // SWAP past
    temp = cm2.past;
    cm2.past = cm1.past;
    cm1.past = temp;

    // SWAP future
    temp = cm2.future;
    cm2.future = cm1.future;
    cm1.future = temp;

    this.editor.setModel(updatedModel);
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.onIndexChange$.next(this.index);

    if (changes.language && this.editor) {
      this.updateLanguage();
    }
    if (changes.dependencies && changes.dependencies.currentValue && this.editor) {
      this.upsertDependencies();
    }
  }

  private emitHandlers(index: string) {
    const handlers = [];

    let groups;
    while ((groups = this.handlersInIndexRegex.exec(index)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (groups.index === this.handlersInIndexRegex.lastIndex) {
        this.handlersInIndexRegex.lastIndex++;
      }

      const handlersInGroup = groups
        .slice(1)
        .filter(Boolean)
        .filter(name => !["async", "const", "var", "let", "function"].includes(name.trim()));
      handlers.push(...handlersInGroup);
    }

    this.handlerEmitter.emit(handlers);
  }

  upsertDependencies() {
    this.clearLibs();

    for (const dep of this.dependencies || []) {
      const defs = Object.values(dep.types || {}).reduce((acc, curr) => acc + "\n" + curr, "");
      this.extraLibDisposables.push(
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          defs,
          `file:///node_modules/${dep.name}/index.d.ts`
        ),
        monaco.languages.typescript.javascriptDefaults.addExtraLib(
          defs,
          `file:///node_modules/${dep.name}/index.d.ts`
        )
      );
    }

    this.updateModelUri(this.editor.getModel());
  }

  clearLibs() {
    this.extraLibDisposables.forEach(d => d.dispose());
    this.extraLibDisposables = [];
  }

  updateLanguage() {
    monaco.editor.setModelLanguage(this.editor.getModel(), this.language);
  }

  ngOnDestroy(): void {
    this.disposables.forEach(d => d.dispose());
    this.extraLibDisposables.forEach(d => d.dispose());
    this.onIndexChangeSubs.unsubscribe();
  }
}
