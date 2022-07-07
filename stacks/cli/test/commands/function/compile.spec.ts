import {Function} from "@spica-server/interface/function";
import {Schema} from "@spica/cli/src/commands/function/orm";
import {FunctionCompiler, HttpTransformer} from "@spica/cli/src/compile";
import * as ts from "typescript";

describe("Function Compiler", () => {
  const print = src => {
    return ts.createPrinter().printFile(src);
  };

  const createSrc = text => {
    return ts.createSourceFile("src.ts", text, ts.ScriptTarget.Latest);
  };

  let fn: Function;
  let index = "";
  let compiler: FunctionCompiler;

  beforeEach(() => {
    fn = {
      name: "fn1",
      env: {},
      language: "js",
      timeout: 100,
      triggers: {
        register: {
          type: "http",
          options: {path: "/register", method: "get"},
          active: true
        },
        onColUpdate: {
          type: "database",
          options: {collection: "col1"},
          active: true
        }
      }
    };

    index = `
    import * as ts from "typescript";
    
    /**
    * Some js doc that should be kept
    */
    export function register(req,res){
      const a = 4;
      // some other ops...
      return res.send("OK");
    }

    /**
    * Some js doc that should be removed
    */
    export function unrelated(){
      console.log("REMOVE ME!")
    }
    `;
    compiler = new FunctionCompiler({...fn, index}, ["http"], "http://test.com");
  });

  it("should filter handlers on code", () => {
    let src = createSrc(index);
    const transformer = compiler.getCodeHandlerFilterer(["register"]);

    src = ts.transform(src, [transformer]).transformed[0] as ts.SourceFile;

    const expectedSrc = createSrc(`;
    /**
    * Some js doc that should be kept
    */
    export function register(req, res) {
        const a = 4;
        // some other ops...
        return res.send("OK");
    }
    ;`);

    expect(print(src)).toEqual(print(expectedSrc));
  });

  it("should transform function", () => {
    const compiledFn = compiler.compile();

    const expectedSrc = createSrc(`
import * as axios from "axios";
;
/**
* Some js doc that should be kept
*/
export function register(params:any,data:any){
return axios.request({params:params,data:data,method:"get",url:"http://test.com/fn-execute/register"}).then((r:any) => r.data);
}
        ;
      `);

    expect(compiledFn).toEqual(print(expectedSrc));
  });

  describe("HttpTriggerTransformer", () => {
    let http: HttpTransformer;

    beforeEach(() => {
      const httpTrigger = {
        register: {
          type: "http",
          options: {path: "/register", method: "get"},
          active: true
        }
      };
      http = new HttpTransformer(httpTrigger, "http://test.com");
    });

    it("should get import declarations", () => {
      let src = createSrc("");

      const imports = http.getImportDeclarations();
      src = ts.factory.updateSourceFile(src, [...imports, ...src.statements]);

      const expectedSrc = createSrc("import * as axios from 'axios'");

      expect(print(src)).toEqual(print(expectedSrc));
    });

    it("should transform http trigger", () => {
      let index = `
        export function register(req,res){
            return res.send("Hello")
        }
        `;
      let src = createSrc(index);
      const transformer = http.getTransformer();

      src = ts.transform(src, [transformer]).transformed[0] as ts.SourceFile;
      const expectedSrc = createSrc(
        `export function register(params:any,data:any){
            return axios.request({params:params,data:data,method:"get",url:"http://test.com/fn-execute/register"}).then((r:any) => r.data);
        }`
      );

      expect(print(src)).toEqual(print(expectedSrc));
    });

    it("should not transform trigger if it's not http", () => {
      let index = `
          export function test(){
              return console.log("Don't touch me!")
          }
          `;
      let src = createSrc(index);
      const transformer = http.getTransformer();

      src = ts.transform(src, [transformer]).transformed[0] as ts.SourceFile;

      const expectedSrc = createSrc(index);

      expect(print(src)).toEqual(print(expectedSrc));
    });
  });
});
