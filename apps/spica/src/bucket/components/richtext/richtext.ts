import {DOCUMENT} from "@angular/common";
import {Component, forwardRef, HostListener, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {InputSchema, INPUT_SCHEMA} from "@spica-client/common";

@Component({
  templateUrl: "./richtext.html",
  styleUrls: ["./richtext.scss"],
  viewProviders: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => RichTextEditorComponent)
    }
  ]
})
export class RichTextEditorComponent implements ControlValueAccessor {
  value: string;
  disabled = false;
  moreActions = false;

  block: string;
  fontSize: number;

  currentFont: string;
  fonts: string[] = [
    "Arial",
    "Brush Script MT",
    "Calibri",
    "Comic Sans MS",
    "Courier",
    "Courier New",
    "Copperplate",
    "Garamond",
    "Georgia",
    "Helvetica",
    "Times New Roman",
    "Verdana"
  ];

  formatting = [
    {
      name: "Heading 1",
      value: "h1"
    },
    {
      name: "Heading 2",
      value: "h2"
    },
    {
      name: "Heading 3",
      value: "h3"
    },
    {
      name: "Heading 4",
      value: "h4"
    },
    {
      name: "Heading 5",
      value: "h5"
    },
    {
      name: "Heading 6",
      value: "h6"
    },
    {
      name: "Paragraph",
      value: "p"
    },
    {
      name: "Predefined",
      value: "pre"
    }
  ];

  onTouchedFn: () => void = () => {};
  onChangeFn: (value: string) => void = () => {};

  constructor(
    @Inject(INPUT_SCHEMA) public readonly schema: InputSchema,
    @Inject(DOCUMENT) private _document: any
  ) {}

  execute(command: string, value: string = null) {
    this._document.execCommand(command, false, value);
  }

  insertUrl() {
    const url = prompt("Insert URL link", "http://");
    this.execute("createlink", url);
  }

  addImage(storage: any) {
    if (storage.content.type.includes("image/")) {
      this.execute("insertImage", storage.url);
    }
  }

  getFormatHTML(format: {name: string; value: string}) {
    return `<${format.value}>${format.name}</${format.value}>`;
  }

  @HostListener("click")
  onTouch(): void {
    if (this.onTouchedFn) {
      this.onTouchedFn();
    }
  }

  writeValue(value: string): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
