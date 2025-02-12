import {_} from "ajv/dist/compile/codegen/index.js";
import {KeywordCxt} from "ajv/dist/compile/validate/index";
import {CodeKeywordDefinition} from "ajv/dist/types";

const def: CodeKeywordDefinition = {
  keyword: "default",
  code(cxt: KeywordCxt, ruleType?: string) {
    const {gen, data, schema, it} = cxt;
    const {opts, parentData, parentDataProperty} = it;
    const defaults = opts["defaults"];
    if (defaults.has(schema)) {
      // TODO: investigate why rule type is empty
      //if (defaulter.type != ruleType) return;
      const defsRef = gen.scopeValue("obj", {
        ref: opts["defaults"]
      });
      const defRef = gen.const("defRef", _`${defsRef}.get(${schema})`);
      gen.block(
        _`${data} = ${parentData}[${parentDataProperty}] = ${defRef}.create(${data} == ${schema} ? undefined : ${data})`
      );
    }
  }
};

export default def;
