import * as ts from "typescript";

export abstract class FunctionDeclarationModifier {
  static modifierName: string;

  private modifiers: ts.Modifier[] = [];
  private name: ts.Identifier;
  private asteriksToken: ts.AsteriskToken;
  private typeParameters: ts.TypeParameterDeclaration[] = [];
  private type: ts.TypeNode;

  body: ts.FunctionBody;
  parameters: ts.ParameterDeclaration[] = [];
  decorators: ts.Decorator[] = [];

  constructor(private node: ts.FunctionDeclaration, private handler: string) {}

  private get isHandlerDefault(): boolean {
    return this.handler == "default";
  }

  private setModifiers(): void {
    const modifiers: ts.ModifierToken<ts.ModifierSyntaxKind>[] = [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)
    ];

    if (this.isHandlerDefault) {
      modifiers.push(ts.factory.createModifier(ts.SyntaxKind.DefaultKeyword));
    }

    this.modifiers = modifiers;
  }

  private setName(): void {
    this.name = !this.isHandlerDefault ? ts.factory.createIdentifier(this.handler) : undefined;
  }

  abstract setBody(): void;

  abstract setParameters(): void;

  abstract setDecorators(): void;

  private setAsteriksToken() {}

  private setTypeParameters() {}

  private setType() {}

  private setAllDeclarationDependencies(): void {
    this.setModifiers();
    this.setName();
    this.setBody();
    this.setParameters();

    // unused for now
    this.setDecorators();
    this.setAsteriksToken();
    this.setTypeParameters();
    this.setType();
  }

  abstract getImports(): ts.ImportDeclaration[];

  public modify(): ts.Node {
    this.setAllDeclarationDependencies();

    return ts.factory.updateFunctionDeclaration(
      this.node,
      this.decorators,
      this.modifiers,
      this.asteriksToken,
      this.name,
      this.typeParameters,
      this.parameters,
      this.type,
      this.body
    );
  }
}
