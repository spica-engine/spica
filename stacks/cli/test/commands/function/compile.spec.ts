import {Function} from "@spica-server/interface/function";
import {FunctionCompiler} from "@spica/cli/src/compile";
import {HttpTransformer} from "@spica/cli/src/function/triggers/http/transformer";
import * as ts from "typescript";

describe("Function Compiler", () => {
  const deletedStatement = `// This statement has been deleted.`;

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
      language: "javascript",
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
    compiler = new FunctionCompiler({...fn, index}, ["http"], "http://test.com", {
      http: {selectedService: "axios"}
    });
  });

  it("should filter handlers on code", () => {
    let src = createSrc(index);
    const transformer = compiler.getHandlerFiltererTransformer(["register"]);

    src = ts.transform(src, [transformer]).transformed[0] as ts.SourceFile;

    const expectedSrc = createSrc(`${deletedStatement}
    ;
    /**
     * Some js doc that should be kept
     */
    export function register(req, res) {
        const a = 4;
        // some other ops...
        return res.send("OK");
    }
    ${deletedStatement}
    ;`);

    expect(print(src)).toEqual(print(expectedSrc));
  });

  it("should transform function", () => {
    const compiledFn = compiler.compile();

    const expectedJs = createSrc(`import axios from "axios";
${deletedStatement}
;
/**
 * Some js doc that should be kept
 */
export function register(config){
return axios.request({...config, method: "get", url: "http://test.com/fn-execute/register"}).then(r => r.data);
}
${deletedStatement}
;
`);

    const expectedDTs = createSrc(`
/**
 * Some js doc that should be kept
 */
export function register(config: any): any;
`);

    expect(compiledFn).toEqual([
      {extension: "js", content: print(expectedJs)},
      {extension: "d.ts", content: print(expectedDTs)}
    ]);
  });

  describe("HttpTriggerTransformer", () => {
    let http: HttpTransformer;
    let imports = [];

    beforeEach(() => {
      imports = [];
      const httpTrigger = {
        register: {
          type: "http",
          options: {path: "/register", method: "get"},
          active: true
        }
      };
      http = new HttpTransformer(httpTrigger, "http://test.com", {
        selectedService: "axios",
        addImports: _imports => {
          imports.push(...imports);
        }
      });
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
        `export function register(config){
            return axios.request({ ...config, method: "get", url: "http://test.com/fn-execute/register" }).then(r => r.data);
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
