import ts from "typescript";

export abstract class FunctionDeclarationModifier {
  static modifierName: string;

  modifiers: ts.Modifier[];
  name: ts.Identifier | undefined;
  asteriksToken: ts.AsteriskToken | undefined;
  typeParameters: ts.TypeParameterDeclaration[] | undefined;
  type: ts.TypeNode | undefined;

  body: ts.FunctionBody | undefined;
  parameters: ts.ParameterDeclaration[];
  decorators: ts.Decorator[] | undefined;

  constructor(private node: ts.FunctionDeclaration) {}

  abstract setBody(): ts.FunctionBody | undefined;

  abstract setParameters(): ts.ParameterDeclaration[];

  abstract setDecorators(): ts.Decorator[] | undefined;

  abstract setAsteriksToken(): ts.AsteriskToken | undefined;

  abstract setTypeParameters(): ts.TypeParameterDeclaration[] | undefined;

  abstract setType(): ts.TypeNode | undefined;

  abstract setModifiers(): ts.Modifier[];

  abstract setName(): ts.Identifier | undefined;

  abstract getExtraFunctionDeclarations(): ts.FunctionDeclaration[];

  private setAllDeclarationDependencies(): void {
    this.modifiers = this.setModifiers();
    this.name = this.setName();
    this.body = this.setBody();
    this.parameters = this.setParameters();

    // unused for now
    this.decorators = this.setDecorators();
    this.asteriksToken = this.setAsteriksToken();
    this.typeParameters = this.setTypeParameters();
    this.type = this.setType();
  }

  abstract getImports(): ts.ImportDeclaration[];

  public modify(): ts.FunctionDeclaration {
    this.setAllDeclarationDependencies();

    return ts.factory.updateFunctionDeclaration(
      this.node,
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

export class SpicaFunctionModifier extends FunctionDeclarationModifier {
  handler: string;

  setBody() {
    return undefined;
  }
  setParameters() {
    return [] as ts.ParameterDeclaration[];
  }

  setDecorators() {
    return undefined;
  }

  setAsteriksToken() {
    return undefined;
  }

  setTypeParameters() {
    return undefined;
  }

  setType() {
    return undefined;
  }

  constructor(node: ts.FunctionDeclaration, handler: string) {
    super(node);
    this.handler = handler;
  }

  private get isHandlerDefault(): boolean {
    return this.handler == "default";
  }

  setModifiers(): ts.Modifier[] {
    const modifiers: ts.Modifier[] = [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)];

    if (this.isHandlerDefault) {
      modifiers.push(ts.factory.createModifier(ts.SyntaxKind.DefaultKeyword));
    }

    return modifiers;
  }

  setName() {
    return !this.isHandlerDefault ? ts.factory.createIdentifier(this.handler) : undefined;
  }

  getImports(): ts.ImportDeclaration[] {
    return [];
  }

  getExtraFunctionDeclarations(): ts.FunctionDeclaration[] {
    return [];
  }
}
