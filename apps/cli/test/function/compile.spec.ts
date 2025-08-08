import {Function} from "../../../../libs/interface/function";
import {FunctionCompiler} from "@spica/cli/src/compile";
import ts from "typescript";

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
 * @typedef RequestConfig
 * @type {Object}
 * @property {object} params - params of the request
 * @property {object} [body] - body of the request
 */
/**
 * @param {RequestConfig} config
 * @returns {Promise<any>}
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
     * @typedef RequestConfig
     * @type {Object}
     * @property {object} params - params of the request
     * @property {object} [body] - body of the request
     */
    /**
     * @param {RequestConfig} config
     * @returns {Promise<any>}
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
 * @typedef RequestConfig
 * @type {Object}
 * @property {object} params - params of the request
 * @property {object} [body] - body of the request
 */
/**
 * @param {RequestConfig} config
 * @returns {Promise<any>}
 */
export function register(config){
  config = {...config, method: "get", url: "http://test.com/fn-execute/register"};
  axiosWriteValidator(config);
  axiosReadValidator(config);
  return axios.request(config).then(r => r.data);
}
${deletedStatement}
;
function axiosWriteValidator(config) {
  if(["post", "put", "patch"].includes(config.method) && !config.data){
      console.warn("Sending empty request body for post, put, patch requests is unusual. If it's not intented, please use config.data or update your spica function.")
  }
}

function axiosReadValidator(config) {
  if(["get", "delete", "trace", "options", "head"].includes(config.method) && config.data){
      console.warn("Sending request body for get, delete, trace, options, head requests is unusual. If it's not intented, please remove config.data or update your spica function.")
  }
}
`);

    const expectedDTs = createSrc(`
/**
 * @typedef RequestConfig
 * @type {Object}
 * @property {object} params - params of the request
 * @property {object} [body] - body of the request
 */
/**
 * @param {RequestConfig} config
 * @returns {Promise<any>}
 */
export function register(config: RequestConfig): Promise<any>;
export type RequestConfig = {
  /**
   * - params of the request
   */
   params: object;
  /**
   * - body of the request
   */
   body?: object
};
`);

    console.log(compiledFn[1].content);
    console.log(print(expectedDTs));

    expect(compiledFn).toEqual([
      {extension: "js", content: print(expectedJs)},
      {extension: "d.ts", content: print(expectedDTs)}
    ]);
  });
});
