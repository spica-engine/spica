import {Component, Input, OnInit} from "@angular/core";
import {DomSanitizer, SafeUrl} from "@angular/platform-browser";

@Component({
  templateUrl: "./doc-try-it.component.html",
  styleUrls: ["./doc-try-it.component.scss"],
  host: {
    "[class.expanded]": "expanded"
  }
})
export class DocTryItComponent {
  expanded = false;

  _definition: Definition;

  _curl: string;

  _apiUrl: string = "https://yourhost";
  _apiKey: string = "placeholder";
  _newline: boolean;

  @Input()
  set definition(value: string) {
    this._definition = JSON.parse(value);
    this.getSavedInputs();
    this.generateCurl();
  }

  constructor(private domSanitizer: DomSanitizer) {}

  getSavedInputs() {
    const url = localStorage.getItem("url");
    this._apiUrl = url || this._apiUrl;
    const apiKey = localStorage.getItem("apikey");
    this._apiKey = apiKey || this._apiKey;
    const newline = localStorage.getItem("newline");
    this._newline = newline != undefined ? !!newline : this._newline;
  }

  saveApiUrl() {
    localStorage.setItem("url", this._apiUrl);
  }

  saveApiKey() {
    localStorage.setItem("apikey", this._apiKey);
  }

  saveNewline() {
    localStorage.setItem("newline", String(this._newline));
  }

  generateCurl() {
    const options = ["--request", this._definition.method];

    if (this._definition.authorization) {
      options.push("--header", `"Authorization: APIKEY ${this._apiKey}"`);
    }

    if (this._definition.accepts) {
      options.push("--header", `"Content-type: ${this._definition.accepts}"`);
    }

    if (this._definition.body) {
      options.push("--data", `"{}"`);
    }

    const routePattern = this._definition.route
      .map(portion => {
        if (typeof portion == "object") {
          return `:${portion.name}`;
        }
        return portion;
      })
      .join("/");

    const baseUrl = new URL(this._apiUrl);
    const url = new URL(routePattern, baseUrl.origin);
    url.pathname = baseUrl.pathname + url.pathname;

    const nl = !this._newline ? "\\ \n      " : "";

    this._curl = `curl ${url} ${nl}${options.reduce((command, option, index, options) => {
      command += `${option} `;
      if (index % 2 != 0 && index != options.length - 1) {
        command += nl;
      }
      return command;
    }, "")}`;
  }
}

interface Definition {
  method: string;
  authorization: boolean;
  route: (string | {name: string; prefix: string; repeat: boolean; optional: boolean})[];
  body: string;
  accepts: string;
}
