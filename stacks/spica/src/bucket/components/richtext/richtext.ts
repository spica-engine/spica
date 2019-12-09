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

  block: string = "p";
  fontSize: number = 5;

  currentFont = "Arial";
  fonts: string[] = ["Arial", "Times New Roman", "Calibri", "Comic Sans MS"];

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

  execute(command: string) {
    const commands = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "pre"];
    if (commands.indexOf(command) > -1) {
      this._document.execCommand("formatBlock", false, command);
    }

    this._document.execCommand(command, false, null);
  }

  insertUrl() {
    const url = prompt("Insert URL link", "http://");
    this._document.execCommand("createlink", false, url);
  }

  setFont(name: string) {
    this._document.execCommand("fontName", false, name);
  }

  setSize(size: number): void {
    this._document.execCommand("fontSize", false, size);
  }

  setTextColor(color: string) {
    this._document.execCommand("foreColor", false, color);
  }

  setBackgroundColor(color: string) {
    this._document.execCommand("hiliteColor", false, color);
  }

  addImage(storage: any) {
    if (storage.content.type.includes("image/")) {
      this._document.execCommand("insertImage", false, storage.url);
    }
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
