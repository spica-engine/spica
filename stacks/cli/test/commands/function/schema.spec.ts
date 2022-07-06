import {Function} from "@spica-server/interface/function";
import {Schema} from "@spica/cli/src/commands/function/orm";
import * as ts from "typescript";

describe("ORM", () => {
  let fn: Function;
  beforeEach(() => {
    fn = {
      name: "fn1",
      env: {},
      language: "js",
      timeout: 100,
      triggers: {
        register: {
          type: "http",
          options: {path: "/register"},
          active: true
        },
        onColUpdate: {
          type: "database",
          options: {collection: "col1"},
          active: true
        }
      }
    };
  });

  it("should filter triggers", () => {
    const triggers = Schema.filterTriggerTypes(fn.triggers, ["http"]);
    expect(triggers).toEqual({
      register: {
        type: "http",
        options: {path: "/register"},
        active: true
      }
    });
  });

  it("should filter code statements", () => {
    const code = `
const a = 5;
/**
* @param
*/
export function register(){}
export function onBucketUpdate(){}
    `;

    const ast = ts.createSourceFile("source.ts", code, ts.ScriptTarget.Latest);

    //@ts-ignore
    ast.statements = Schema.filterAstStatements(ast.statements, fn.triggers);

    const expectedCode = `
/**
* @param
*/
export function register(){}
    `;
    const expectedAst = ts.createSourceFile("expected.ts", expectedCode, ts.ScriptTarget.Latest);
    expect(ts.createPrinter().printFile(ast)).toEqual(ts.createPrinter().printFile(expectedAst));
  });

  describe("builders", () => {
    it("should build http method", () => {
      const code = `
      export function register(req,res){
        console.log("Spica is awesome!")
      }
      `;

      const ast = ts.createSourceFile("source.ts",code,ts.ScriptTarget.Latest)

      const handlerStatement = Schema.findHandlerStatement("register",ast.statements);
      const statement = Schema.Http.build(handlerStatement,fn.triggers.register,"http://localhost:4300")
      //@ts-ignore
      ast.statements = [statement]
      ts.createPrinter().printFile(ast)

    });
  });
});
