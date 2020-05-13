import {
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {Scheme, SchemeObserver} from "@spica-client/core/layout";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";

@Component({
  selector: "code-editor",
  template: "",
  styleUrls: ["./editor.component.scss"],
  providers: [
    {provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EditorComponent), multi: true}
  ],
  host: {"(init)": "onEditorInit()"}
})
export class EditorComponent
  implements OnInit, OnChanges, OnDestroy, DoCheck, ControlValueAccessor {
  @Output() init = new EventEmitter();
  @Output() save = new EventEmitter();
  @Input() options: monaco.editor.IEditorConstructionOptions;

  private monacoPath: string = "assets/function/min/vs";
  private editorRef: monaco.editor.IStandaloneCodeEditor;
  private dispose = new Subject();

  private theme: string;

  private get _options(): monaco.editor.IEditorConstructionOptions {
    return {
      model: monaco.editor.createModel(
        this.value,
        (this.options && this.options.language) || "typescript"
      ),
      ...this.options,
      theme: this.theme,
      scrollBeyondLastLine: false,
      cursorBlinking: "phase",
      fontLigatures: true,
      fontFamily: "Fira Code",
      lineNumbersMinChars: 2
    };
  }

  // Sometimes monaco being loaded slower than
  // Control Value Accessor which causes to
  // binding inconsistency.
  // @internal
  private value: string = String();

  private onTouched = () => {};
  private onChanged = (obj: any) => {};

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private zone: NgZone,
    private schemeObserver: SchemeObserver
  ) {}

  writeValue(obj: any): void {
    this.value = obj;
    if (this.editorRef) {
      this.editorRef.setValue(obj || "");
    }
  }

  registerOnChange(fn: any): void {
    this.onChanged = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    if (this.editorRef) {
      this.editorRef.updateOptions({readOnly: isDisabled});
    }
  }

  onEditorInit(): void {
    this.editorRef.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () =>
      this.zone.run(() => this.save.emit())
    );
  }

  changeScheme(isDark: boolean) {
    this.theme = isDark ? "vs-dark" : "vs-light";
    if (window.monaco) {
      monaco.editor.setTheme(this.theme);
    }
  }

  ngOnInit(): void {
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

    this.schemeObserver
      .observe(Scheme.Dark)
      .pipe(takeUntil(this.dispose))
      .subscribe(r => this.changeScheme(r));
  }

  ngDoCheck(): void {
    if (this.editorRef && this.elementRef.nativeElement) {
      const elemrect = this.elementRef.nativeElement.getBoundingClientRect();
      const editorrect = this.editorRef.getLayoutInfo();
      if (
        Math.abs(elemrect.width - editorrect.width) <= 5 ||
        Math.abs(elemrect.height - editorrect.height) <= 5
      ) {
        this.editorRef.layout();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.editorRef && changes.options && changes.options.previousValue) {
      if (changes.options.previousValue.language !== changes.options.currentValue.language) {
        monaco.editor.setModelLanguage(this.editorRef.getModel(), this._options.language);
      }
      if (changes.options.previousValue.theme !== changes.options.currentValue.theme) {
        monaco.editor.setTheme(this._options.theme);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.editorRef) {
      this.editorRef.dispose();
    }

    this.dispose.next();
  }
}
