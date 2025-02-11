import {Component, Inject} from "@angular/core";
import {MAT_DIALOG_DATA} from "@angular/material/dialog";
import {JSONSchema7} from "json-schema";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";
import {ComposerClient, TargetOptions} from "../../composer.client";
import {ElementSchema} from "../../interface";

@Component({
  selector: "composer-builder",
  templateUrl: "./builder.component.html",
  styleUrls: ["./builder.component.scss"]
})
export class BuilderComponent {
  context: Observable<JSONSchema7>;
  services: Observable<any[]>;

  schema: Observable<ElementSchema>;
  properties: any;

  routerLink: string;

  forOf: Observable<any>;
  forOfArguments: any;

  constructor(
    @Inject(MAT_DIALOG_DATA) private target: TargetOptions,
    private cc: ComposerClient
  ) {
    this.context = this.cc.fromEvent("context");
    this.services = this.cc.fromEvent<any>("services");
    this.schema = this.cc.fromEvent<any>("element schema").pipe(
      map(schema => {
        this.properties = schema.properties;
        return schema.schema;
      })
    );

    this.forOf = this.cc.fromEvent<any>("forof").pipe(
      map(schema => {
        this.forOfArguments = schema.arguments;
        return schema.schema;
      })
    );

    this.cc
      .fromEvent<any[]>("routerlink")
      .subscribe(r => (this.routerLink = r.filter(seg => seg != "/").join("/")));
    this.cc.emit("element schema", target);
    this.cc.emit("services");
  }

  addNgForOf(service: any) {
    this.cc.emit("add forof", this.target, service.name, this.forOfArguments);
  }

  save() {
    if (this.forOfArguments) {
      this.cc.emit("update forof", this.target, this.forOfArguments);
    }
    if (this.routerLink) {
      this.cc.emit("upsert routerlink", this.target, this.routerLink.split("/"));
    }

    this.cc.emit("update element properties", this.target, this.properties);
  }
}
