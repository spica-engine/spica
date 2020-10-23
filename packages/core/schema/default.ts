import {
    AddedFormat,
    FormatValidator,
    AsyncFormatValidator,
    CodeKeywordDefinition,
    KeywordErrorDefinition,
    ErrorObject,
  } from "ajv/dist/types"
  import type KeywordCxt from "ajv/dist/compile/context"
  import {_, str, nil, or, Code, getProperty} from "ajv/dist/compile/codegen"
  

  
  
  const def: CodeKeywordDefinition = {
    keyword: "default",
    code(cxt: KeywordCxt, ruleType?: string) {
      const {gen, data, $data, schema, schemaCode, it} = cxt
      const {opts, errSchemaPath, schemaEnv, parentData, parentDataProperty, self} = it
        const defaults = opts['defaults'];
        let defaulter;
        if ( defaulter = defaults.has(schema) ) {
            if ( defaulter.type != ruleType ) return;
            const defsRef = gen.scopeValue("formats", {
                ref: opts['defaults']
            })
            const defRef = gen.const("defRef", _`${defsRef}.get(${schema}).create`);
            
            gen.block(_`${parentData}[${parentDataProperty}] = ${defRef}(${data} == ${schema} ? undefined : ${data})`);
        }
    },  
  }
  
  export default def
