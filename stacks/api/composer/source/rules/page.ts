import {strings, tags} from "@angular-devkit/core";
import {buildRelativePath, stripTsExtension} from "../../utils/path";
import {APP_ROUTING_PATH} from "../contants";
import {apply, chain} from "./base";
import {addRoute} from "./routing";
import {empty as emptySource, source, writeSource} from "./source";

export function empty(name: string, route: string) {
  return () => {
    const classifiedName = strings.classify(`${name}Page`);
    const selector = strings.dasherize(classifiedName);
    const path = `src/app/${strings.dasherize(name)}.page.ts`;
    const src = tags.stripIndent`
            import * as i0 from '@angular/core';

            export class ${classifiedName} {
                static ngComponentDef = i0.ɵdefineComponent({
                    type: ${classifiedName},
                    selectors: [ [ '${selector}' ] ],
                    factory: (type) => new (type || ${classifiedName})(),
                    consts: 0,
                    vars: 0,
                    template: template,
                    encapsulation: 2,
                    directives: [],
                    pipes: []
                });
                constructor() {}
            }

            function template(rf: i0.ɵRenderFlags, context: ${classifiedName}) {
                if (rf & i0.ɵRenderFlags.Create) {}
                if (rf & i0.ɵRenderFlags.Update) {}
            }`;

    return chain(
      apply(emptySource(src), writeSource(path)),
      apply(
        source(APP_ROUTING_PATH),
        chain((_, ctx) => {
          ctx.transforms.push(
            addRoute(
              ctx,
              route,
              classifiedName,
              buildRelativePath(APP_ROUTING_PATH, stripTsExtension(path))
            )
          );
        }, writeSource(APP_ROUTING_PATH))
      )
    );
  };
}
