/// <reference path="../../../../../node_modules/monaco-editor/monaco.d.ts" />
import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  NgZone,
  Output,
  ViewChild
} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {Scheme, SchemeObserver} from "@spica-client/core";
import {fromEvent, Subject, Subscription} from "rxjs";
import {takeUntil} from "rxjs/operators";

let loadedMonaco = false;
let loadPromise: Promise<void>;

@Component({
  selector: "code-editor",
  template: '<div class="editor-container" #editorContainer></div>',
  styles: [
    `
                      :host {
                        display: block;
                      }
                
                      .editor-container {
                        width: 100%;
                        height: 100%;
                        min-height: 100px;
                      }
                    `
  ],
  styleUrls: ["./editor.component.scss"],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EditorComponent),
      multi: true
    }
  ]
})
export class EditorComponent implements ControlValueAccessor {
  @Input("ngModel") _value: string = "";
  @Input() options: any = {};
  @Input() model: any;

  @Output() onInit = new EventEmitter<any>();
  @Output() save = new EventEmitter();

  @ViewChild("editorContainer", {static: true}) _editorContainer: ElementRef;

  private dispose = new Subject();

  private editor: monaco.editor.IStandaloneCodeEditor;
  private windowResizeSubscription: Subscription;

  private propagateChange = (_: any) => {};
  private onTouched = () => {};

  private disposables: monaco.IDisposable[] = [];

  writeValue(value: any): void {
    this._value = value || "";
    // Fix for value change while dispose in process.
    setTimeout(() => {
      if (this.editor && !this.options.model) {
        this.editor.setValue(this._value);
      }
    });
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  constructor(private zone: NgZone, private schemeObserver: SchemeObserver) {
    this.initializeWorkerSelector();
  }

  ngAfterViewInit() {
    this.loadMonaco();
  }

  initializeWorkerSelector() {
    window["MonacoEnvironment"] = {
      getWorker: function(_, label) {
        if (label === "typescript" || label === "javascript") {
          return new Worker(new URL("./workers/ts.worker", import.meta.url), {
            type: "module",
            name: "js/ts-worker"
          });
        } else if (label === "json") {
          return new Worker(new URL("./workers/json.worker", import.meta.url), {
            type: "module",
            name: "json-worker"
          });
        } else if (label === "handlebars") {
          return new Worker(new URL("./workers/handlebars.worker", import.meta.url), {
            type: "module",
            name: "handlebars-worker"
          });
        }
        return new Worker(new URL("./workers/ts.worker", import.meta.url), {
          type: "module",
          name: "editor-worker"
        });
      }
    };
  }

  loadMonaco() {
    if (loadedMonaco) {
      // Wait until monaco editor is available
      loadPromise.then(() => {
        this.initMonaco(this.options);
      });
    } else {
      loadedMonaco = true;
      loadPromise = new Promise<void>((resolve: any) => {
        const onGotAmdLoader: any = () => {
          // Load monaco
          (<any>window).require.config({paths: {vs: "./assets/monaco/min/vs"}});
          (<any>window).require(["vs/editor/editor.main"], () => {
            this.initMonaco(this.options);
            resolve();
          });
        };

        // Load AMD loader if necessary
        if (!(<any>window).require) {
          const loaderScript: HTMLScriptElement = document.createElement("script");
          loaderScript.type = "text/javascript";
          loaderScript.src = `./assets/monaco/min/vs/loader.js`;
          loaderScript.addEventListener("load", onGotAmdLoader);
          document.body.appendChild(loaderScript);
        } else {
          onGotAmdLoader();
        }
      });
    }
  }

  initMonaco(options: any): void {
    const hasModel = !!options.model;

    if (hasModel) {
      const model = monaco.editor.getModel(options.model.uri || "");
      if (model) {
        options.model = model;
        options.model.setValue(this._value);
      } else {
        options.model = monaco.editor.createModel(
          options.model.value,
          options.model.language,
          options.model.uri
        );
      }
    }

    this.editor = monaco.editor.create(this._editorContainer.nativeElement, options);

    if (!hasModel) {
      this.editor.setValue(this._value);
    }

    this.disposables.push(
      this.editor.onDidChangeModelContent((e: any) => {
        const value = this.editor.getValue();

        // value is not propagated to parent when executing outside zone.
        this.zone.run(() => {
          this.propagateChange(value);
          this._value = value;
        });
      })
    );

    this.disposables.push(
      this.editor.onDidBlurEditorWidget(() => {
        this.onTouched();
      })
    );

    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () =>
      this.zone.run(() => this.save.emit())
    );

    this.resizeWhenWindowResized();

    this.handleThemeChanges();

    this.onInit.emit(this.editor);
  }

  resizeWhenWindowResized() {
    if (this.windowResizeSubscription) {
      this.windowResizeSubscription.unsubscribe();
    }

    this.windowResizeSubscription = fromEvent(window, "resize").subscribe(() =>
      this.editor.layout()
    );
  }

  handleThemeChanges() {
    this.schemeObserver
      .observe(Scheme.Dark)
      .pipe(takeUntil(this.dispose))
      .subscribe(isDark => {
        const theme = isDark ? "vs-dark" : "vs-light";
        monaco.editor.setTheme(theme);
      });
  }

  ngOnDestroy() {
    this.disposables.forEach(d => d.dispose());

    if (this.windowResizeSubscription) {
      this.windowResizeSubscription.unsubscribe();
    }

    if (this.editor) {
      this.editor.dispose();
      this.editor = undefined;
    }
  }
}
