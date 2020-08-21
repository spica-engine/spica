import * as ts from "typescript";

export function evaluateExpression(expr: ts.Expression): any {
    function objectLiteralVisitor(expr: ts.ObjectLiteralExpression) {
        const properties = expr.properties as ts.NodeArray<ts.PropertyAssignment>;
        if (!properties) {
            return {};
        }

        const data: any = {};

        for (let i = 0; i < properties.length; i++) {
        const property = properties[i];

        if (ts.isIdentifier(property.name)) {
            data[property.name.text] = evaluateExpression(property.initializer);
        } else {
            console.debug(`Evaluation warning: ${ts.SyntaxKind[property.name.kind]} is not supported.`);
        }
        }
        return data;
    }    
    
    function arrayLiteralVisitor(expr: ts.ArrayLiteralExpression) {
        const elements = expr.elements;
        if (!elements) {
        return [];
        }

        const data = [];

        for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        data.push(evaluateExpression(element));
        }

        return data;
    }


    switch (expr.kind) {
        case ts.SyntaxKind.StringLiteral:
            return (<ts.StringLiteral>expr).text;
        case ts.SyntaxKind.NumericLiteral:
            return Number((<ts.NumericLiteral>expr).text);
        case ts.SyntaxKind.TrueKeyword:
        case ts.SyntaxKind.FalseKeyword:
            return (<ts.BooleanLiteral>expr).getText() == "true";
        case ts.SyntaxKind.ObjectLiteralExpression:
            return objectLiteralVisitor(<ts.ObjectLiteralExpression>expr);
        case ts.SyntaxKind.ArrayLiteralExpression:
            return arrayLiteralVisitor(<ts.ArrayLiteralExpression>expr);
        default:
            return undefined;
    }
}