import {_} from "ajv/dist/compile/codegen";
import KeywordCxt from "ajv/dist/compile/context";
import {CodeKeywordDefinition} from "ajv/dist/types";

const def: CodeKeywordDefinition = {
  keyword: "default",
  code(cxt: KeywordCxt, ruleType?: string) {
    const {gen, data, schema, it} = cxt;
    const {opts, parentData, parentDataProperty} = it;
    const defaults = opts["defaults"];
    let defaulter;

    if ((defaulter = defaults.has(schema))) {
      if (defaulter.type != ruleType) return;
      const defsRef = gen.scopeValue("formats", {
        ref: opts["defaults"]
      });
      const defRef = gen.const("defRef", _`${defsRef}.get(${schema}).create`);

      gen.block(
        _`${parentData}[${parentDataProperty}] = ${defRef}(${data} == ${schema} ? undefined : ${data})`
      );
    }
  }
};

export default def;
