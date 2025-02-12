import {
  Axios,
  AxiosReadValidator,
  AxiosWriteValidator
} from "@spica/cli/src/function/triggers/http/services";
import ts from "typescript";

describe("Axios", () => {
  let emptyFn: ts.FunctionDeclaration;

  function createSrc(code: string) {
    return ts.createSourceFile("dummy.js", code, ts.ScriptTarget.Latest);
  }

  function print(src: ts.SourceFile) {
    return ts.createPrinter().printFile(src);
  }

  beforeEach(() => {
    emptyFn = ts.factory.createFunctionDeclaration(
      [],
      undefined,
      "test",
      [],
      [],
      undefined,
      undefined
    );
  });

  describe("Service", () => {
    let axios: Axios;
    let trigger = {
      options: {
        method: "Get",
        path: "/test"
      },
      type: "http"
    };

    beforeEach(() => {
      axios = new Axios(emptyFn, "test", "http://domain/api", trigger, []);
    });

    describe("without validators", () => {
      it("should modify function", () => {
        const updatedFn = axios.modify();

        const expectedSrc = createSrc(`
                export function test(config){
                    config = {...config, method: 'get', url: "http://domain/api/fn-execute/test" };
                    return axios.request(config).then(r => r.data);
                }
                `);

        let actualSrc = createSrc("");
        actualSrc = ts.factory.updateSourceFile(actualSrc, [updatedFn]);

        expect(print(expectedSrc)).toEqual(print(actualSrc));
      });
    });

    describe("with default validators", () => {
      beforeEach(() => {
        axios = new Axios(emptyFn, "test", "http://domain/api", trigger);
      });

      it("should modify function", () => {
        const updatedFn = axios.modify();

        const expectedSrc = createSrc(`
                export function test(config){
                    config = {...config, method: 'get', url: "http://domain/api/fn-execute/test" };
                    axiosWriteValidator(config);
                    axiosReadValidator(config);
                    return axios.request(config).then(r => r.data);
                }
                `);

        let actualSrc = createSrc("");
        actualSrc = ts.factory.updateSourceFile(actualSrc, [updatedFn]);

        expect(print(expectedSrc)).toEqual(print(actualSrc));
      });

      it("should get extra function declarations", () => {
        const extras = axios.getExtraFunctionDeclarations();

        const expectedSrc = createSrc(`function axiosWriteValidator(config) {
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

        let actualSrc = createSrc("");
        actualSrc = ts.factory.updateSourceFile(actualSrc, extras);

        expect(print(expectedSrc)).toEqual(print(actualSrc));
      });
    });

    it("should get imports", () => {
      const imports = axios.getImports();

      const expectedSrc = createSrc("import axios from 'axios'");

      let actualSrc = createSrc("");
      actualSrc = ts.factory.updateSourceFile(actualSrc, [...imports]);

      expect(print(expectedSrc)).toEqual(print(actualSrc));
    });
  });

  describe("Axios Write Validator", () => {
    let writeValidator: AxiosWriteValidator;

    beforeEach(() => {
      writeValidator = new AxiosWriteValidator(emptyFn);
    });

    it("should get validator", () => {
      const validator = writeValidator.modify();
      const expectedSrc = createSrc(`function axiosWriteValidator(config) {
                if(["post", "put", "patch"].includes(config.method) && !config.data){
                    console.warn("Sending empty request body for post, put, patch requests is unusual. If it's not intented, please use config.data or update your spica function.")
                }
            }
            `);

      let actualSrc = createSrc("");
      actualSrc = ts.factory.updateSourceFile(actualSrc, [validator]);

      expect(print(expectedSrc)).toEqual(print(actualSrc));
    });
  });

  describe("Axios Read Validator", () => {
    let readValidator: AxiosReadValidator;

    beforeEach(() => {
      readValidator = new AxiosReadValidator(emptyFn);
    });

    it("should get validator", () => {
      const validator = readValidator.modify();
      const expectedSrc = createSrc(`function axiosReadValidator(config) {
                if(["get", "delete", "trace", "options", "head"].includes(config.method) && config.data){
                    console.warn("Sending request body for get, delete, trace, options, head requests is unusual. If it's not intented, please remove config.data or update your spica function.")
                }
            }
            `);

      let actualSrc = createSrc("");
      actualSrc = ts.factory.updateSourceFile(actualSrc, [validator]);

      expect(print(expectedSrc)).toEqual(print(actualSrc));
    });
  });
});
