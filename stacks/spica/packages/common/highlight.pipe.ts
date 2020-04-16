import {Pipe, Output, EventEmitter, ElementRef, Input} from "@angular/core";

@Pipe({
  name: "highlight"
})
export class HighlightPipe {
  private editorRef: monaco.editor.IStandaloneCodeEditor;
  private monacoPath: string = "assets/function/min/vs";
  @Input() options: monaco.editor.IEditorConstructionOptions;
  private get _options() {
    return {
      model: monaco.editor.createModel(this.value, "typescript"),
      ...this.options,
      scrollBeyondLastLine: false,
      cursorBlinking: "phase",
      fontLigatures: true,
      fontFamily: "Fira Code",
      lineNumbersMinChars: 2,
      theme: "vs-dark"
    };
  }

  // Sometimes monaco being loaded slower than
  // Control Value Accessor which causes to
  // binding inconsistency.
  // @internal
  private value: string = String();

  private onChanged = (obj: any) => {};
  private onTouched = () => {};
  @Output() init = new EventEmitter();
  constructor(private elementRef: ElementRef<HTMLElement>) {
    const onGotAmdLoader = () => {
      window["require"]["config"]({paths: {vs: this.monacoPath}});
      //@ts-ignore
      window["require"](["vs/editor/editor.main"], () => {
        this.editorRef = monaco.editor.create(this.elementRef.nativeElement, this._options);
        this.editorRef.onDidChangeModelContent(() => {
          this.onChanged(this.editorRef.getValue());
        });
        this.editorRef.onDidBlurEditorText(() => {
          this.onTouched();
        });
        this.init.emit(this.editorRef);
      });
    };

    let loaderScript: any = null;
    if (!window["require"]) {
      loaderScript = document.createElement("script");
      loaderScript.type = "text/javascript";
      loaderScript.src = `${this.monacoPath}/loader.js`;
      loaderScript.addEventListener("load", onGotAmdLoader);
      document.body.appendChild(loaderScript);
    } else {
      onGotAmdLoader();
    }
  }

  transform(value: any) {
    let str: string = "";

    value.map(val => {
      str += JSON.stringify(val, undefined, 2);
    });

    return monaco.editor.colorize(str, "javascript", {tabSize: 2});
  }
}
