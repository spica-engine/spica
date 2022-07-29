import {HttpTransformer} from "@spica/cli/src/function/triggers";
import * as ts from "typescript";

describe("HttpTriggerTransformer", () => {
  function createSrc(code: string) {
    return ts.createSourceFile("dummy.js", code, ts.ScriptTarget.Latest);
  }

  function print(src: ts.SourceFile) {
    return ts.createPrinter().printFile(src);
  }

  let http: HttpTransformer;
  let imports = [];
  let extraFns = [];

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
      },
      addExtraFunctions: fns => extraFns.push(...fns)
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
            config = { ...config, method: "get", url: "http://test.com/fn-execute/register" };
            axiosWriteValidator(config);
            axiosReadValidator(config);
            return axios.request(config).then(r => r.data);
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
