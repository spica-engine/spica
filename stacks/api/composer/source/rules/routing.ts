import * as path from "path";
import * as ts from "typescript";
import {APP_ROUTING_PATH} from "../contants";
import {Rule, SourceContext} from "../interface";
import {apply} from "./base";
import {source} from "./source";
import {template} from "./template";
import {addDirective} from "./def";

export function addRoute(
  ctx: SourceContext,
  route: string,
  importSpecifier: string,
  moduleSpecifier: string
): ts.TransformerFactory<ts.SourceFile> {
  const namespaceIdentifier = ctx.import.ensure(moduleSpecifier);
  return context => {
    const visit: ts.Visitor = node => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isTypeReferenceNode(node.type) &&
        node.type.typeName.getText() === "Routes"
      ) {
        const initializer = node.initializer as ts.ArrayLiteralExpression;

        return ts.updateVariableDeclaration(
          node,
          node.name,
          node.type,
          ts.createArrayLiteral(
            ts.createNodeArray([
              ...initializer.elements,
              ts.createObjectLiteral(
                ts.createNodeArray([
                  ts.createPropertyAssignment("path", ts.createStringLiteral(route)),
                  ts.createPropertyAssignment(
                    "component",
                    ts.createPropertyAccess(namespaceIdentifier, importSpecifier)
                  )
                ])
              )
            ])
          )
        );
      }

      return ts.visitEachChild(node, visit, context);
    };

    return node => ts.visitNode(node, visit);
  };
}

export const getRoutes: Rule<unknown, any[]> = apply(source(APP_ROUTING_PATH), (sf, ctx) => {
  const routes = [];
  visitor(sf);
  function visitor(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isTypeReferenceNode(node.type) &&
      node.type.typeName.getText() === "Routes"
    ) {
      const initializer = node.initializer as ts.ArrayLiteralExpression;
      initializer.elements.forEach((expression: ts.ObjectLiteralExpression) =>
        routes.push(
          expression.properties.reduce((prev: any, property: ts.PropertyAssignment) => {
            let name = (property.name as ts.Identifier).escapedText.toString();
            let value;

            if (ts.isStringLiteral(property.initializer)) {
              value = property.initializer.text;
            } else if (
              ts.isPropertyAccessExpression(property.initializer) &&
              ts.isIdentifier(property.initializer.expression)
            ) {
              value = property.initializer.name.text;

              const moduleIdentifier = ctx.import.getModule(property.initializer.expression.text);

              prev["source"] = path.join(path.dirname(APP_ROUTING_PATH), moduleIdentifier + ".ts");
            }

            if (name == "path") {
              value = `/${value}`;
            }

            prev[name] = value;

            return prev;
          }, {})
        )
      );
    }
    ts.forEachChild(node, visitor);
  }
  return routes;
});

export type RouterLink = string[];

export function getRouterLink(templ: template.Template, index: string): RouterLink | null {
  const routerLinkProperty = template.getInstructionProperty(templ, index, "routerLink");

  const routerLink = [];

  if (routerLinkProperty) {
    const bindExpression = routerLinkProperty.arguments[2] as ts.CallExpression;
    const valueExpression = bindExpression.arguments[0];

    //TODO: Handle this also; i0.ɵpureFunction1(1, _c3, ctx_r0.title)
    if (ts.isArrayLiteralExpression(valueExpression)) {
      for (let i = 0; i < valueExpression.elements.length; i++) {
        const elementExpr = valueExpression.elements[i];
        if (ts.isStringLiteral(elementExpr)) {
          routerLink.push(elementExpr.text);
        }
      }
      return routerLink;
    } else {
      throw new Error("getRouterLink: Not implemented yet.");
    }
  }

  return null;
}

export function upsertRouterLink(
  templ: template.Template,
  ctx: SourceContext,
  index: string,
  segments: string[]
): ts.TransformerFactory<ts.SourceFile>[] {
  return [
    addDirective(ctx, "RouterLink", "@angular/router"),
    template.removeInstructionProperties(templ, index, ["routerLink"]),
    template.addInstructionProperty(
      templ,
      ctx,
      index,
      "routerLink",
      ts.createArrayLiteral(
        ts.createNodeArray([
          ts.createStringLiteral("/"),
          ...segments.map(seg => ts.createLiteral(seg))
        ])
      )
    )
  ];
}
