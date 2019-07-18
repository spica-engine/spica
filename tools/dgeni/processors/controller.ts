import {DocCollection, Processor} from "dgeni";
import {parse, Token} from "path-to-regexp";

export class ControllerProcessor implements Processor {
  httpMethods = ["Delete", "Get", "Post", "Patch"];
  name = "controller-processor";
  $runBefore = ["docs-processed"];

  $process(docs: DocCollection) {
    const removeQuotes = (s: string) => String(s || "").replace(/^"(.*)"$/, "$1");
    const processPath = (path: string): Token[] =>
      parse(path).map(p => (typeof p == "string" && p.replace(/^\/?(.*?)\/?$/g, "$1")) || p);
    const getDecoratorName = (decorator: any) => decorator.expression.expression.escapedText;

    return docs.map(doc => {
      if (doc.docType == "class") {
        doc.decorators = doc.decorators || [];
        const controller = doc.decorators!.find((d: any) => d.name == "Controller");
        if (controller) {
          doc.docType = "controller";

          doc.members = doc.members
            .filter((member: any) => member.docType == "member")
            .map((member: any) => {
              member.decorators = member.decorators || [];
              const methodDecorator = member.decorators.find(
                (d: any) => this.httpMethods.indexOf(d.name) > -1
              );
              if (methodDecorator) {
                member.docType = "route";
                member.type = methodDecorator.name.toUpperCase();
                member.route = [
                  ...processPath(removeQuotes(controller.arguments[0])),
                  ...processPath(removeQuotes(methodDecorator.arguments[0]))
                ];
                member.authorization = false;
                member.actions = [];

                const guardDecorator = member.decorators.find((d: any) => d.name == "UseGuards");
                if (guardDecorator) {
                  const guards = guardDecorator.expression.expression.arguments;

                  member.authorization =
                    guards && guards.find((g: any) => g.expression.escapedText == "AuthGuard");
                  const actionGuard = guards.find(
                    (g: any) => g.expression.escapedText == "ActionGuard"
                  );
                  if (actionGuard) {
                    const actions = actionGuard.arguments[0];
                    // string
                    if (actions.kind == 10) {
                      member.actions = [actions.text];
                    }
                    // string[]
                    else if (actions.kind == 188) {
                      member.actions = actions.elements.map((token: any) => token.text);
                    }
                  }
                }

                member.parameterDocs.forEach((param: any) => {
                  const decorator = param.declaration.decorators![0];
                  const name = getDecoratorName(decorator);
                  if (
                    !name ||
                    !decorator.expression.arguments[0] ||
                    (decorator.expression.arguments[0] &&
                      decorator.expression.arguments[0].kind != 10)
                  ) {
                    param.private = true;
                    return;
                  }
                  if (!param.description && member.params) {
                    const taggedDesc = member.params.find((tag: any) => tag.name == param.name);
                    if (taggedDesc) {
                      param.description = taggedDesc.description;
                    }
                  }

                  param.docType = name.toLowerCase();
                  param.name = decorator.expression.arguments[0].text;

                  member[param.docType] = member[param.docType] || [];
                  member[param.docType].push(param);
                });
              }
              return member;
            });
        }
      }
      return doc;
    });
  }
}
