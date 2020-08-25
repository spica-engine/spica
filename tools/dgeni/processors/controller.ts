import {DocCollection, Processor} from "dgeni";
import {parse, Token} from "path-to-regexp";
import { evaluateExpression } from "../helper/evaluator";

export function BodyTag() {
  return {
    name: 'body',
    transforms: [  (doc: any, _: any, value: any) => {
      doc.body = value;
      return value;
    }]
  };
};

export function AcceptsTag() {
  return {
    name: 'accepts',
    transforms: [  (doc: any, _: any, value: any) => {
      doc.accepts = value;
      return value;
    }]
  };
};

export function BodySchemaTag() {
  return {
    name: 'bodySchema',
    transforms: [  (doc: any, _: any, value: any) => {
      doc.bodySchema = value;
      return value;
    }]
  };
};

export class ControllerProcessor implements Processor {
  httpMethods = ["Delete", "Get", "Post", "Patch", "Put"];
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
                member.query = [];
                member.param = [];
                member.headers =  [];

                const guardDecorator = member.decorators.find((d: any) => d.name == "UseGuards");
                if (guardDecorator) {
                  const guards = guardDecorator.expression.expression.arguments;

                  member.authorization = !!(guards && guards.find((g: any) => g.expression.escapedText == "AuthGuard"));
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

                  if ( name == "Query" ) {
     
                    for (const pipe of decorator.expression.arguments) {

                      if ( pipe.kind == 196 && pipe.expression.escapedText == 'DEFAULT' ) {
                        const [arg] = pipe.arguments;
                        param.isOptional = true;
                        const def = evaluateExpression(arg);
                        param.defaultValue = def || param.defaultValue;
                      }
                   
                    }
                  }
               
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

                  if ( Array.isArray( member[param.docType]) ) {
                    member[param.docType].push(param);
                  }
                });

                member.tryIt = {
                  method: member.type,
                  route: member.route,
                  authorization: member.authorization,
                  actions: member.actions,
                  header: member.headers.map( (h: any) => {
                    return {
                      name: h.name,
                      type: h.type,
                      defaultValue: h.defaultValue,
                      optional: h.isOptional
                    } 
                  }),
                  query: member.query.map( (q :any) => {
                    return {
                      name: q.name,
                      type: q.type,
                      defaultValue: q.defaultValue,
                      optional: q.isOptional
                    } 
                  }),
                  param: member.param.map( (p :any) => {
                    return {
                      name: p.name,
                      type: p.type,
                      defaultValue: p.defaultValue,
                      optional: p.isOptional
                    } 
                  }),
                  bodySchema: member.bodySchema,
                  body: member.body,
                  accepts: member.body ?  member.accepts || "application/json" : undefined,
                }
              }
             
           

              return member;
            });
        }
      }
      return doc;
    });
  }
}
