import {AddedFormat, CodeKeywordDefinition, KeywordErrorDefinition} from "ajv/dist/types";
import {KeywordCxt} from "ajv/dist/compile/validate/index";
import {_, str, nil, or, Code, getProperty} from "ajv/dist/compile/codegen/index.js";
import {FormatValidate} from "@spica-server/interface/core";

const error: KeywordErrorDefinition = {
  message: ({schemaCode}) => str`should match format "${schemaCode}"`,
  params: ({schemaCode}) => _`{format: ${schemaCode}}`
};

const def: CodeKeywordDefinition = {
  keyword: "format",
  type: ["number", "string"],
  schemaType: "string",
  error,
  code(cxt: KeywordCxt, ruleType?: string) {
    const {gen, data, $data, schema, schemaCode, it} = cxt;
    const {opts, errSchemaPath, schemaEnv, parentData, parentDataProperty, self} = it;

    if (!opts.validateFormats) return;

    if ($data) validate$DataFormat();
    else validateFormat();

    function validate$DataFormat(): void {
      const fmts = gen.scopeValue("formats", {
        ref: self.formats,
        code: opts.code.formats
      });
      const fDef = gen.const("fDef", _`${fmts}[${schemaCode}]`);
      const fType = gen.let("fType");
      const format = gen.let("format");
      // TODO simplify
      gen.if(
        _`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`,
        () => gen.assign(fType, _`${fDef}.type || "string"`).assign(format, _`${fDef}.validate`),
        () => gen.assign(fType, _`"string"`).assign(format, fDef)
      );

      cxt.fail$data(or(unknownFmt(), invalidFmt())); // TODO this is not tested. Possibly require ajv-formats to test formats in ajv as well

      function unknownFmt(): Code {
        if (opts.strict === false) return nil;
        return _`${schemaCode} && !${format}`;
      }

      function invalidFmt(): Code {
        const callFormat = schemaEnv.$async
          ? _`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))`
          : _`${format}(${data})`;
        const validData = _`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;

        return _`console.log(${data});${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
      }
    }

    function validateFormat(): void {
      const formatDef: AddedFormat | undefined = self.formats[schema];
      if (!formatDef) {
        unknownFormat();
        return;
      }
      if (formatDef === true) return;
      const [fmtType, format, fmtRef, coerceRef] = getFormat(formatDef);
      if (fmtType === ruleType) {
        cxt.pass(validCondition());
        cxt.gen.code(coerce());
      }

      function unknownFormat(): void {
        if (opts.strict === false) {
          self.logger.warn(unknownMsg());
          return;
        }
        throw new Error(unknownMsg());

        function unknownMsg(): string {
          return `unknown format "${schema as string}" ignored in schema at path "${errSchemaPath}"`;
        }
      }

      function getFormat(fmtDef: AddedFormat): [string, FormatValidate, Code, Code | undefined] {
        const fmt = gen.scopeValue("formats", {
          key: schema,
          ref: fmtDef,
          code: opts.code.formats ? _`${opts.code.formats}${getProperty(schema)}` : undefined
        });

        let coerce = undefined;

        if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
          if (fmtDef["coerce"]) {
            coerce = _`${fmt}.coerce`;
          }
          return [fmtDef.type || "string", fmtDef.validate, _`${fmt}.validate`, coerce];
        }

        return ["string", fmtDef, fmt, coerce];
      }

      function coerce() {
        if (coerceRef) {
          return _`${parentData}[${parentDataProperty}] = ${coerceRef}(${data})`;
        }
      }

      function validCondition(): Code {
        if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
          if (!schemaEnv.$async) throw new Error("async format in sync schema");
          return _`await ${fmtRef}(${data})`;
        }

        return typeof format == "function" ? _`${fmtRef}(${data})` : _`${fmtRef}.test(${data})`;
      }
    }
  }
};

export default def;
